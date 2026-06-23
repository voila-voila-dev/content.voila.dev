// The `voila_media` record store over a real (in-memory) SQLite driver, with
// the table created from `deriveSchema` — so the store and the DDL stay in
// lockstep. Covers CRUD, the newest-first keyset pagination, and cursor
// validation.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { type MediaStore, makeMediaStore } from "./store";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }), cover: fields.media() },
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
let store: MediaStore;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  store = makeMediaStore(driver);
});

function seedRecord(n: number) {
  return store.insert({
    id: `id-${n}`,
    key: `id-${n}/file-${n}.png`,
    filename: `file-${n}.png`,
    mime: "image/png",
    size: 100 + n,
  });
}

describe("insert / get", () => {
  it("round-trips a full record", async () => {
    const inserted = await store.insert({
      id: "m1",
      key: "m1/cat.png",
      filename: "cat.png",
      mime: "image/png",
      size: 1234,
      width: 800,
      height: 600,
      alt: "a cat",
    });
    expect(inserted.createdAt).toBeGreaterThan(0);
    const fetched = await store.get("m1");
    expect(fetched).toEqual(inserted);
  });

  it("omits absent optional fields rather than returning nulls", async () => {
    await seedRecord(1);
    const fetched = await store.get("id-1");
    expect(fetched).not.toBeNull();
    expect(fetched).not.toHaveProperty("width");
    expect(fetched).not.toHaveProperty("height");
    expect(fetched).not.toHaveProperty("alt");
  });

  it("returns null for an unknown id", async () => {
    expect(await store.get("nope")).toBeNull();
  });

  it("rejects a duplicate storage key (unique index)", async () => {
    await seedRecord(1);
    expect(
      store.insert({ id: "other", key: "id-1/file-1.png", filename: "x", mime: "x", size: 1 }),
    ).rejects.toThrow();
  });
});

describe("delete", () => {
  it("removes a record and tolerates a missing id", async () => {
    await seedRecord(1);
    await store.delete("id-1");
    expect(await store.get("id-1")).toBeNull();
    await store.delete("id-1");
  });
});

describe("list", () => {
  it("pages newest-first with a keyset cursor", async () => {
    // Force distinct createdAt ordering by inserting with controlled clocks:
    // the store stamps Date.now(), so insert sequentially and rely on the id
    // tiebreaker for same-millisecond rows.
    for (let n = 1; n <= 5; n++) await seedRecord(n);

    const first = await store.list({ limit: 2 });
    expect(first.records.length).toBe(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await store.list({ limit: 2, cursor: first.nextCursor ?? undefined });
    const third = await store.list({ limit: 2, cursor: second.nextCursor ?? undefined });
    expect(third.records.length).toBe(1);
    expect(third.nextCursor).toBeNull();

    const ids = [...first.records, ...second.records, ...third.records].map((r) => r.id);
    expect(new Set(ids).size).toBe(5);
    // Newest first: id-5 was inserted last.
    expect(ids[0]).toBe("id-5");
    expect(ids[4]).toBe("id-1");
  });

  it("rejects a malformed cursor", async () => {
    expect(store.list({ cursor: "garbage" })).rejects.toThrow(/Malformed media cursor/);
  });

  it("returns an empty page on an empty library", async () => {
    const page = await store.list();
    expect(page.records).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
