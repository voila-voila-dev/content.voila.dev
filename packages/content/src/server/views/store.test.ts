// The SHARED `voila_views` store over a real (in-memory) SQLite driver, with the
// table created from `deriveSchema`. Covers CRUD, the cross-user sharing (views
// are global, the creator id is audit-only), the one-default-per-collection
// rule, the seeded undeletable default Table view, and the JSON config round-trip.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { defaultViewId, makeViewStore, type ViewStore } from "./store";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }) },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
    for (const idx of table.indexes) {
      const idxCols = idx.columns.map((c) => `"${c}"`).join(", ");
      stmts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX "${idx.name}" ON "${idx.table}" (${idxCols})`,
      );
    }
  }
  return stmts;
}

let driver: SqliteDriver;
let store: ViewStore;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  store = makeViewStore(driver);
});

describe("makeViewStore — emitted table", () => {
  it("derives a `voila_views` system table whenever the config has collections", () => {
    const table = deriveSchema(config).find((t) => t.name === "voila_views");
    expect(table?.system).toBe(true);
    expect(table?.columns.map((c) => c.name)).toContain("owner_id");
  });
});

describe("makeViewStore — CRUD", () => {
  it("creates and lists a view, round-tripping its JSON config", async () => {
    const created = await store.create(
      "posts",
      {
        name: "Recent",
        type: "table",
        config: {
          columns: ["title", "createdAt"],
          sort: { field: "createdAt", direction: "desc" },
          filters: [{ field: "title", op: "contains", value: "hi" }],
        },
      },
      "alice",
    );
    expect(created.id).toBeTruthy();
    expect(created.ownerId).toBe("alice");
    expect(created.isDefault).toBe(false);
    expect(created.seeded).toBe(false);

    const listed = await store.list("posts");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Recent");
    expect(listed[0]?.config.columns).toEqual(["title", "createdAt"]);
    expect(listed[0]?.config.sort).toEqual({ field: "createdAt", direction: "desc" });
    expect(listed[0]?.config.filters).toEqual([{ field: "title", op: "contains", value: "hi" }]);
  });

  it("updates supplied fields and leaves the rest", async () => {
    const created = await store.create(
      "posts",
      { name: "A", type: "table", config: { columns: ["title"] } },
      "alice",
    );
    const updated = await store.update("posts", created.id, { name: "B", type: "kanban" });
    expect(updated?.name).toBe("B");
    expect(updated?.type).toBe("kanban");
    // Untouched field survives.
    expect(updated?.config.columns).toEqual(["title"]);
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it("deletes a view", async () => {
    const created = await store.create("posts", { name: "A", type: "table", config: {} }, "alice");
    await store.delete("posts", created.id);
    expect(await store.list("posts")).toHaveLength(0);
  });
});

describe("makeViewStore — shared across users", () => {
  it("lets any user see and edit any view (creator id is audit-only)", async () => {
    const aliceView = await store.create(
      "posts",
      { name: "Alice", type: "table", config: {} },
      "alice",
    );

    // Bob sees Alice's view and can read it by id.
    expect(await store.list("posts")).toHaveLength(1);
    expect((await store.get(aliceView.id))?.ownerId).toBe("alice");
    // Bob can update it (views are shared); the creator id is unchanged.
    const updated = await store.update("posts", aliceView.id, { name: "Edited by Bob" });
    expect(updated?.name).toBe("Edited by Bob");
    expect(updated?.ownerId).toBe("alice");
    // …and delete it.
    await store.delete("posts", aliceView.id);
    expect(await store.get(aliceView.id)).toBeNull();
  });

  it("won't update or delete a view through a different collection", async () => {
    const view = await store.create("posts", { name: "P", type: "table", config: {} }, "alice");
    // Wrong collection → update is a no-op (null) and delete leaves the row.
    expect(await store.update("articles", view.id, { name: "X" })).toBeNull();
    await store.delete("articles", view.id);
    expect(await store.get(view.id)).not.toBeNull();
    // Correct collection still works.
    expect(await store.update("posts", view.id, { name: "X" })).not.toBeNull();
  });
});

describe("makeViewStore — one default per collection", () => {
  it("keeps only the most recently defaulted view as the default", async () => {
    const first = await store.create(
      "posts",
      { name: "First", type: "table", config: {}, isDefault: true },
      "alice",
    );
    const second = await store.create(
      "posts",
      { name: "Second", type: "table", config: {}, isDefault: true },
      "bob",
    );
    const views = await store.list("posts");
    const defaults = views.filter((v) => v.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe(second.id);

    // Promoting the first back to default demotes the second (global, cross-user).
    await store.update("posts", first.id, { isDefault: true });
    const after = await store.list("posts");
    expect(after.filter((v) => v.isDefault).map((v) => v.id)).toEqual([first.id]);
  });
});

describe("makeViewStore — seeded default", () => {
  it("seeds an undeletable default Table view, idempotently", async () => {
    const seeded = await store.ensureDefault("posts", "alice");
    expect(seeded.id).toBe(defaultViewId("posts"));
    expect(seeded.seeded).toBe(true);
    expect(seeded.type).toBe("table");
    expect(seeded.isDefault).toBe(true);

    // Calling again is a no-op (same row, not a duplicate).
    const again = await store.ensureDefault("posts", "bob");
    expect(again.id).toBe(seeded.id);
    expect(await store.list("posts")).toHaveLength(1);
  });

  it("refuses to delete the seeded default and locks its type to table", async () => {
    const seeded = await store.ensureDefault("posts", "alice");
    await store.delete("posts", seeded.id);
    expect(await store.get(seeded.id)).not.toBeNull();
    // A type patch on the seeded view is ignored — a table always exists.
    const updated = await store.update("posts", seeded.id, { type: "kanban", name: "Renamed" });
    expect(updated?.type).toBe("table");
    expect(updated?.name).toBe("Renamed");
  });
});
