// `Database` write methods over real (in-memory) SQLite: create fills system
// columns and echoes the stored row, update bumps `updatedAt` and is scoped to
// live rows, soft-delete hides a row while hard-delete purges it, restore revives
// a soft-deleted row, and a unique violation surfaces as a `DatabaseError` with
// `conflict: true` and the offending field.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";
import type { Document } from "./types";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string(),
    slug: fields.string({ unique: true }),
    views: fields.number(),
    published: fields.boolean(),
  },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      if (c.defaultExpr?.sqlite) parts.push(`DEFAULT ${c.defaultExpr.sqlite}`);
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

let db: ReturnType<typeof makeDatabase>;
let counter = 0;

beforeEach(async () => {
  counter = 0;
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  db = makeDatabase(config, driver);
});

const draft = (): Document => ({
  title: "Hello",
  slug: `hello-${counter++}`,
  views: 0,
  published: false,
});

describe("Database write methods", () => {
  it("create fills system columns and returns the stored row", async () => {
    const doc = await db.create("posts", draft());
    expect(typeof doc.id).toBe("string");
    expect((doc.id as string).length).toBeGreaterThan(0);
    expect(doc.title).toBe("Hello");
    expect(doc.published).toBe(false); // 0 → boolean on read
    expect(typeof doc.createdAt).toBe("number");
    expect(doc.deletedAt).toBeNull();
  });

  it("update patches supplied fields, bumps updatedAt, leaves the rest", async () => {
    const created = await db.create("posts", draft());
    const next = await db.update("posts", created.id as string, {
      title: "Edited",
      published: true,
    });
    expect(next?.title).toBe("Edited");
    expect(next?.published).toBe(true);
    expect(next?.slug).toBe("hello-0"); // untouched
    expect(next?.updatedAt as number).toBeGreaterThanOrEqual(created.updatedAt as number);
  });

  it("update returns null for a missing row", async () => {
    expect(await db.update("posts", "nope", { title: "x" })).toBeNull();
  });

  it("soft-delete hides the row from reads; restore brings it back", async () => {
    const created = await db.create("posts", draft());
    const deleted = await db.softDelete("posts", created.id as string);
    const afterDelete = await db.get("posts", created.id as string);
    const restored = await db.restore("posts", created.id as string);
    const afterRestore = await db.get("posts", created.id as string);

    expect(deleted).toBe(true);
    expect(afterDelete).toBeNull(); // hidden
    expect(restored?.title).toBe("Hello");
    expect(afterRestore).not.toBeNull(); // live again
  });

  it("hard-delete purges even a soft-deleted row", async () => {
    const created = await db.create("posts", draft());
    await db.softDelete("posts", created.id as string);
    const purged = await db.hardDelete("posts", created.id as string);
    const restored = await db.restore("posts", created.id as string);

    expect(purged).toBe(true);
    expect(restored).toBeNull(); // nothing left to restore
  });

  it("a unique violation surfaces as a conflict with the offending field", async () => {
    await db.create("posts", { title: "A", slug: "dupe", views: 0, published: false });
    let error: unknown;
    try {
      await db.create("posts", { title: "B", slug: "dupe", views: 0, published: false });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).conflict).toBe(true);
    expect((error as DatabaseError).field).toBe("slug");
  });
});
