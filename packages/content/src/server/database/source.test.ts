// `makeDatabase(config, driver, { sources })` over an external collection: calls
// for the external slug dispatch to the registered `CollectionSource` (never the
// driver), methods the source lacks and table-only features reject with
// `DatabaseError { unsupported: true }`, an external slug with no source names
// the missing registration, a source for a non-external slug is a boot-time
// error, and a table-backed collection keeps working alongside over real
// in-memory SQLite.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";
import type { CollectionSource } from "./source";
import type { Database, Document, ListOpts } from "./types";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }) },
});

const customers = defineCollection({
  slug: "customers",
  external: true,
  fields: {
    name: fields.string({ required: true }),
    email: fields.string({ unique: true }),
  },
});

// External, but never given a source — every call must name the missing wiring.
const orphans = defineCollection({
  slug: "orphans",
  external: true,
  fields: { name: fields.string() },
});

const config = defineConfig({
  branding: { name: "Test" },
  collections: { posts, customers, orphans },
});

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
  }
  return stmts;
}

// A plain in-memory source: a Map of documents plus a log of the `ListOpts` it
// received, so tests can assert on the normalized shape the framework hands over.
interface MemorySource extends CollectionSource {
  readonly rows: Map<string, Document>;
  readonly listCalls: Array<ListOpts>;
}

function memorySource(seed: ReadonlyArray<Document>, opts: { readonly writable: boolean }) {
  const rows = new Map<string, Document>(seed.map((doc) => [String(doc.id), doc]));
  const listCalls: Array<ListOpts> = [];
  const source: MemorySource = {
    rows,
    listCalls,
    list: async (listOpts) => {
      listCalls.push(listOpts);
      return { documents: [...rows.values()], nextCursor: null, total: rows.size };
    },
    get: async (id) => rows.get(id) ?? null,
    findOne: async (field, value) => [...rows.values()].find((doc) => doc[field] === value) ?? null,
    ...(opts.writable
      ? {
          create: async (values: Document) => {
            const doc = { id: `c${rows.size + 1}`, ...values };
            rows.set(String(doc.id), doc);
            return doc;
          },
          update: async (id: string, values: Document) => {
            const current = rows.get(id);
            if (current === undefined) return null;
            const doc = { ...current, ...values };
            rows.set(id, doc);
            return doc;
          },
          delete: async (id: string) => rows.delete(id),
        }
      : {}),
  };
  return source;
}

const ada: Document = { id: "c1", name: "Ada", email: "ada@example.com" };
const grace: Document = { id: "c2", name: "Grace", email: "grace@example.com" };
const seed: ReadonlyArray<Document> = [ada, grace];

let driver: SqliteDriver;
let source: MemorySource;
let db: Database;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  source = memorySource(seed, { writable: true });
  db = makeDatabase(config, driver, { sources: { customers: source } });
});

async function rejection(promise: Promise<unknown>): Promise<DatabaseError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DatabaseError) return error;
    throw error;
  }
  throw new Error("expected a rejection");
}

describe("makeDatabase — external collection dispatch", () => {
  it("routes list/get/findOne to the source", async () => {
    const page = await db.list("customers", { count: true });
    expect(page.documents.map((d) => d.id)).toEqual(["c1", "c2"]);
    expect(page.total).toBe(2);
    expect(await db.get("customers", "c2")).toEqual(grace);
    expect(await db.get("customers", "nope")).toBeNull();
    expect(await db.findOne("customers", "email", "ada@example.com")).toEqual(ada);
  });

  it("hands the source normalized list options (clamped limit, defaulted order)", async () => {
    await db.list("customers", {
      limit: 1000,
      filters: [{ field: "name", op: "eq", value: "Ada" }],
    });
    expect(source.listCalls[0]).toEqual({
      limit: 100,
      orderBy: "id",
      direction: "desc",
      filters: [{ field: "name", op: "eq", value: "Ada" }],
    });
    await db.list("customers", { orderBy: "createdAt", direction: "asc" });
    expect(source.listCalls[1]).toMatchObject({
      orderBy: "createdAt",
      direction: "asc",
      limit: 20,
    });
  });

  it("rejects unknown orderBy / filter / lookup fields before touching the source", async () => {
    expect((await rejection(db.list("customers", { orderBy: "nope" }))).message).toMatch(
      /Unknown orderBy field "nope"/,
    );
    expect(
      (await rejection(db.list("customers", { filters: [{ field: "zip", op: "eq", value: 1 }] })))
        .message,
    ).toMatch(/Unknown filter field "zip"/);
    expect((await rejection(db.findOne("customers", "zip", 1))).message).toMatch(
      /Unknown lookup field "zip"/,
    );
    expect(source.listCalls).toHaveLength(0);
  });

  it("routes create/update and both delete flavors to the source", async () => {
    const created = await db.create("customers", { name: "Linus" });
    expect(created).toEqual({ id: "c3", name: "Linus" });
    expect(await db.update("customers", "c3", { name: "Linus T." })).toEqual({
      id: "c3",
      name: "Linus T.",
    });
    expect(await db.update("customers", "missing", { name: "x" })).toBeNull();
    expect(await db.softDelete("customers", "c1")).toBe(true);
    expect(await db.hardDelete("customers", "c2")).toBe(true);
    expect(await db.hardDelete("customers", "c2")).toBe(false);
    expect([...source.rows.keys()]).toEqual(["c3"]);
  });

  it("wraps a source rejection as a DatabaseError with the source error as cause", async () => {
    const boom = new Error("upstream down");
    const failing: CollectionSource = {
      list: async () => {
        throw boom;
      },
      get: async () => null,
    };
    const broken = makeDatabase(config, driver, { sources: { customers: failing } });
    const error = await rejection(broken.list("customers"));
    expect(error.message).toBe('Failed to list "customers".');
    expect(error.cause).toBe(boom);
    expect(error.unsupported).toBe(false);
  });
});

describe("makeDatabase — unsupported operations on an external collection", () => {
  it("flags methods the source does not implement", async () => {
    const readOnly = makeDatabase(config, driver, {
      sources: { customers: memorySource(seed, { writable: false }) },
    });
    for (const call of [
      readOnly.create("customers", { name: "x" }),
      readOnly.update("customers", "c1", { name: "x" }),
      readOnly.softDelete("customers", "c1"),
      readOnly.hardDelete("customers", "c1"),
      readOnly.search("customers", "ada"),
    ]) {
      const error = await rejection(call);
      expect(error.unsupported).toBe(true);
      expect(error.message).toMatch(/not supported by external collection "customers"/);
    }
  });

  it("flags the table-only features regardless of the source", async () => {
    for (const call of [
      db.upsert("customers", { name: "x" }),
      db.restore("customers", "c1"),
      db.publish("customers", "c1"),
      db.unpublish("customers", "c1"),
      db.listRevisions("customers", "c1"),
      db.getRevision("customers", "c1", 1),
      db.restoreRevision("customers", "c1", 1),
    ]) {
      expect((await rejection(call)).unsupported).toBe(true);
    }
  });
});

describe("makeDatabase — external collection wiring", () => {
  it("rejects every call on an external slug with no source registered", async () => {
    for (const call of [
      db.list("orphans"),
      db.get("orphans", "x"),
      db.create("orphans", {}),
      db.publish("orphans", "x"),
    ]) {
      const error = await rejection(call);
      expect(error.unsupported).toBe(false);
      expect(error.message).toMatch(/External collection "orphans" has no source registered/);
    }
  });

  it("throws at construction for a source registered under a non-external slug", () => {
    const stray = memorySource([], { writable: false });
    expect(() => makeDatabase(config, driver, { sources: { posts: stray } })).toThrow(
      /"posts" is not declared `external: true`/,
    );
  });

  it("throws at construction for a source registered under an unknown slug", () => {
    const stray = memorySource([], { writable: false });
    expect(() => makeDatabase(config, driver, { sources: { nope: stray } })).toThrow(
      /"nope" is not a collection of this config/,
    );
  });

  it("keeps the two-argument form working", async () => {
    const plain = makeDatabase(config, driver);
    const created = await plain.create("posts", { title: "Hello" });
    expect(created.title).toBe("Hello");
    expect((await rejection(plain.list("customers"))).message).toMatch(/no source registered/);
  });

  it("serves table-backed collections through SQL alongside the external one", async () => {
    const created = await db.create("posts", { title: "Hello" });
    expect((await db.get("posts", String(created.id)))?.title).toBe("Hello");
    expect((await db.list("posts")).documents).toHaveLength(1);
    // The SQL path still rejects an unknown slug the classic way.
    expect((await rejection(db.list("nope"))).message).toBe('Unknown collection "nope".');
    // And the source never saw the posts traffic.
    expect(source.listCalls).toHaveLength(0);
  });
});
