// The owner-scoped `voila_views` store over a real (in-memory) SQLite driver,
// with the table created from `deriveSchema`. Covers CRUD, owner isolation
// (every method scopes by owner), the one-default-per-collection rule, and the
// JSON config round-trip.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeViewStore, type ViewStore } from "./store";

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
    const created = await store.create("alice", "posts", {
      name: "Recent",
      type: "table",
      config: {
        columns: ["title", "createdAt"],
        sort: { field: "createdAt", direction: "desc" },
        filters: [{ field: "title", op: "contains", value: "hi" }],
      },
    });
    expect(created.id).toBeTruthy();
    expect(created.ownerId).toBe("alice");
    expect(created.isDefault).toBe(false);

    const listed = await store.list("alice", "posts");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Recent");
    expect(listed[0]?.config.columns).toEqual(["title", "createdAt"]);
    expect(listed[0]?.config.sort).toEqual({ field: "createdAt", direction: "desc" });
    expect(listed[0]?.config.filters).toEqual([{ field: "title", op: "contains", value: "hi" }]);
  });

  it("updates supplied fields and leaves the rest", async () => {
    const created = await store.create("alice", "posts", {
      name: "A",
      type: "table",
      config: { columns: ["title"] },
    });
    const updated = await store.update("alice", "posts", created.id, { name: "B", type: "kanban" });
    expect(updated?.name).toBe("B");
    expect(updated?.type).toBe("kanban");
    // Untouched field survives.
    expect(updated?.config.columns).toEqual(["title"]);
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it("deletes a view", async () => {
    const created = await store.create("alice", "posts", { name: "A", type: "table", config: {} });
    await store.delete("alice", "posts", created.id);
    expect(await store.list("alice", "posts")).toHaveLength(0);
  });
});

describe("makeViewStore — owner isolation", () => {
  it("never leaks another owner's views across list/get/update/delete", async () => {
    const aliceView = await store.create("alice", "posts", {
      name: "Alice",
      type: "table",
      config: {},
    });

    // Bob sees none of Alice's views.
    expect(await store.list("bob", "posts")).toHaveLength(0);
    expect(await store.get("bob", aliceView.id)).toBeNull();
    // Bob can't update or delete Alice's view.
    expect(await store.update("bob", "posts", aliceView.id, { name: "Hacked" })).toBeNull();
    await store.delete("bob", "posts", aliceView.id);
    // Alice's view is intact and unchanged.
    const stillThere = await store.get("alice", aliceView.id);
    expect(stillThere?.name).toBe("Alice");
  });

  it("won't update or delete a view through a different collection", async () => {
    const view = await store.create("alice", "posts", { name: "P", type: "table", config: {} });
    // Wrong collection → update is a no-op (null) and delete leaves the row.
    expect(await store.update("alice", "articles", view.id, { name: "X" })).toBeNull();
    await store.delete("alice", "articles", view.id);
    expect(await store.get("alice", view.id)).not.toBeNull();
    // Correct collection still works.
    expect(await store.update("alice", "posts", view.id, { name: "X" })).not.toBeNull();
  });
});

describe("makeViewStore — one default per collection", () => {
  it("keeps only the most recently defaulted view as the default", async () => {
    const first = await store.create("alice", "posts", {
      name: "First",
      type: "table",
      config: {},
      isDefault: true,
    });
    const second = await store.create("alice", "posts", {
      name: "Second",
      type: "table",
      config: {},
      isDefault: true,
    });
    const views = await store.list("alice", "posts");
    const defaults = views.filter((v) => v.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe(second.id);

    // Promoting the first back to default demotes the second.
    await store.update("alice", "posts", first.id, { isDefault: true });
    const after = await store.list("alice", "posts");
    expect(after.filter((v) => v.isDefault).map((v) => v.id)).toEqual([first.id]);
  });

  it("scopes the one-default rule per collection and per owner", async () => {
    // Alice's default in `posts` and Bob's default in `posts` coexist.
    await store.create("alice", "posts", { name: "A", type: "table", config: {}, isDefault: true });
    await store.create("bob", "posts", { name: "B", type: "table", config: {}, isDefault: true });
    expect((await store.list("alice", "posts")).filter((v) => v.isDefault)).toHaveLength(1);
    expect((await store.list("bob", "posts")).filter((v) => v.isDefault)).toHaveLength(1);
  });
});
