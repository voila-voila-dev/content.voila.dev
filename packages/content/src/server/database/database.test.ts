// `Database` read path over real (in-memory) SQLite: list maps rows to camelCase
// documents with parsed JSON, hides soft-deleted rows, and paginates via the
// opaque keyset cursor (including the trailing NULL partition); get/findOne scope
// to live rows. The schema is rendered straight from the descriptor (`deriveSchema`)
// so the test stays inside `@voila/content` — the CLI's DDL renderer isn't needed.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    meta: fields.json(),
    // Nullable — used to exercise NULL ordering in keyset pagination.
    rank: fields.number(),
  },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

// Minimal CREATE TABLE / CREATE INDEX rendered from the dialect-neutral
// descriptor — just enough for the Database to read/write against.
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
      const cols2 = idx.columns.map((c) => `"${c}"`).join(", ");
      stmts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX "${idx.name}" ON "${idx.table}" (${cols2})`,
      );
    }
  }
  return stmts;
}

interface SeedRow {
  readonly id: string;
  readonly title: string;
  readonly meta: unknown;
  readonly rank?: number | null;
  readonly deletedAt?: number;
}

// ids are lexicographically ordered, so id-desc = newest first.
const seedRows: ReadonlyArray<SeedRow> = [
  { id: "p1", title: "First", meta: { tag: "a" }, rank: null },
  { id: "p2", title: "Second", meta: { tag: "b" }, rank: 5 },
  { id: "p3", title: "Third", meta: { tag: "c" }, rank: null },
  { id: "p4", title: "Fourth", meta: { tag: "d" }, rank: 10 },
  { id: "p5", title: "Gone", meta: null, rank: 99, deletedAt: 1_700_000_000_000 },
];

let driver: SqliteDriver;

async function bootstrap(): Promise<ReturnType<typeof makeDatabase>> {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  for (const row of seedRows) {
    await driver.run(
      "INSERT INTO posts (id, title, meta, rank, deleted_at) VALUES (?, ?, ?, ?, ?)",
      [row.id, row.title, JSON.stringify(row.meta), row.rank ?? null, row.deletedAt ?? null],
    );
  }
  return makeDatabase(config, driver);
}

let db: ReturnType<typeof makeDatabase>;
beforeEach(async () => {
  db = await bootstrap();
});

// Walk every page, returning the ids in visit order. Guards against runaway loops.
async function pageThrough(opts: {
  readonly orderBy?: string;
  readonly direction?: "asc" | "desc";
}): Promise<Array<unknown>> {
  const seen: Array<unknown> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const page = await db.list("posts", { ...opts, limit: 1, cursor: cursor ?? undefined });
    seen.push(...page.documents.map((d) => d.id));
    cursor = page.nextCursor;
    if (cursor === null) break;
  }
  return seen;
}

// bun types `expect(p).rejects.*` as returning void (so `await` reads as a no-op);
// assert rejections explicitly instead — run, catch, check the error type.
async function expectDatabaseError(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(DatabaseError);
    return;
  }
  throw new Error("expected the call to reject with a DatabaseError");
}

describe("Database.list", () => {
  it("returns live rows newest-first, mapping to camelCase documents with parsed JSON", async () => {
    const result = await db.list("posts");

    expect(result.documents.map((d) => d.id)).toEqual(["p4", "p3", "p2", "p1"]);
    expect(result.nextCursor).toBeNull();

    const first = result.documents[0];
    expect(first).toMatchObject({ id: "p4", title: "Fourth", meta: { tag: "d" }, deletedAt: null });
    expect(typeof first?.createdAt).toBe("number");
  });

  it("excludes soft-deleted rows", async () => {
    const result = await db.list("posts");
    expect(result.documents.map((d) => d.id)).not.toContain("p5");
  });

  it("paginates via the opaque cursor without overlap", async () => {
    const seen: Array<unknown> = [];
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const page = await db.list("posts", { limit: 2, cursor: cursor ?? undefined });
      seen.push(...page.documents.map((d) => d.id));
      cursor = page.nextCursor;
      if (cursor === null) break;
    }
    expect(seen).toEqual(["p4", "p3", "p2", "p1"]);
  });

  it("includes NULL-ordered rows across page boundaries (keyset, NULLS LAST)", async () => {
    // Order by a nullable column: non-null ranks desc, then the NULL partition.
    // The bug this guards against silently dropped the rank=NULL rows (p1, p3).
    const ids = await pageThrough({ orderBy: "rank", direction: "desc" });
    expect(ids).toEqual(["p4", "p2", "p3", "p1"]);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
  });

  it("rejects a cursor reused under a different orderBy", async () => {
    const page = await db.list("posts", { limit: 1 }); // minted under orderBy "id"
    await expectDatabaseError(() =>
      db.list("posts", { limit: 1, cursor: page.nextCursor ?? "", orderBy: "title" }),
    );
  });

  it("honors orderBy + direction", async () => {
    const result = await db.list("posts", { orderBy: "title", direction: "asc" });
    expect(result.documents.map((d) => d.title)).toEqual(["First", "Fourth", "Second", "Third"]);
  });

  it("clamps the limit and signals more pages", async () => {
    const result = await db.list("posts", { limit: 2 });
    expect(result.documents).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("computes the scope's total with count, independent of the page cursor", async () => {
    const first = await db.list("posts", { limit: 2, count: true });
    expect(first.documents).toHaveLength(2);
    // All pages, soft-deleted p5 excluded.
    expect(first.total).toBe(4);

    const second = await db.list("posts", {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
      count: true,
    });
    expect(second.total).toBe(4);
  });

  it("omits total unless count is requested", async () => {
    const result = await db.list("posts", { limit: 2 });
    expect(result.total).toBeUndefined();
  });

  it("rejects an unknown collection with a DatabaseError", async () => {
    await expectDatabaseError(() => db.list("nope"));
  });

  it("rejects an unknown orderBy field with a DatabaseError", async () => {
    await expectDatabaseError(() => db.list("posts", { orderBy: "nope" }));
  });
});

describe("Database.get", () => {
  it("returns a mapped document for a live id", async () => {
    expect(await db.get("posts", "p2")).toMatchObject({
      id: "p2",
      title: "Second",
      meta: { tag: "b" },
    });
  });

  it("returns null for a missing id", async () => {
    expect(await db.get("posts", "absent")).toBeNull();
  });

  it("returns null for a soft-deleted id", async () => {
    expect(await db.get("posts", "p5")).toBeNull();
  });
});

describe("Database.findOne", () => {
  it("returns the first live row matching a field/value", async () => {
    expect(await db.findOne("posts", "title", "Second")).toMatchObject({
      id: "p2",
      title: "Second",
      meta: { tag: "b" },
    });
  });

  it("returns null when nothing matches", async () => {
    expect(await db.findOne("posts", "title", "Nope")).toBeNull();
  });

  it("excludes soft-deleted rows", async () => {
    expect(await db.findOne("posts", "title", "Gone")).toBeNull();
  });

  it("rejects an unknown field with a DatabaseError", async () => {
    await expectDatabaseError(() => db.findOne("posts", "nope", "x"));
  });

  it("rejects an unknown collection with a DatabaseError", async () => {
    await expectDatabaseError(() => db.findOne("nope", "title", "x"));
  });
});
