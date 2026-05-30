import { describe, expect, it } from "bun:test";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Either, Layer } from "effect";
import { defineConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { SqliteLive } from "../client/sqlite";
import { deriveSchema } from "../ddl/derive-schema";
import { generateDDL } from "../ddl/generate-ddl";
import { splitStatements } from "../migrator/loader";
import { makeDatabaseLayer } from "./database";
import { Database, type ListResult } from "./types";

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
const schemaStatements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));

interface SeedRow {
  readonly id: string;
  readonly title: string;
  readonly meta: unknown;
  readonly rank?: number | null;
  readonly deletedAt?: number;
}

// ids are lexicographically ordered (ULIDs sort this way), so id-desc = newest first.
const seedRows: ReadonlyArray<SeedRow> = [
  { id: "p1", title: "First", meta: { tag: "a" }, rank: null },
  { id: "p2", title: "Second", meta: { tag: "b" }, rank: 5 },
  { id: "p3", title: "Third", meta: { tag: "c" }, rank: null },
  { id: "p4", title: "Fourth", meta: { tag: "d" }, rank: 10 },
  { id: "p5", title: "Gone", meta: null, rank: 99, deletedAt: 1_700_000_000_000 },
];

const bootstrap = Effect.gen(function* () {
  const sql = yield* SqlClient;
  for (const statement of schemaStatements) yield* sql.unsafe(statement);
  for (const row of seedRows) {
    yield* sql.unsafe(
      "INSERT INTO posts (id, title, meta, rank, deleted_at) VALUES (?, ?, ?, ?, ?)",
      [row.id, row.title, JSON.stringify(row.meta), row.rank ?? null, row.deletedAt ?? null],
    );
  }
});

// One in-memory connection shared by setup (SqlClient) and the Database service.
const layer = makeDatabaseLayer(config).pipe(Layer.provideMerge(SqliteLive({ url: ":memory:" })));

const run = <A, E>(body: Effect.Effect<A, E, Database | SqlClient>): Promise<A> =>
  Effect.runPromise(Effect.provide(bootstrap.pipe(Effect.zipRight(body)), layer));

// Walk every page, returning the ids in visit order. Guards against runaway loops.
const pageThrough = (opts: { readonly orderBy?: string; readonly direction?: "asc" | "desc" }) =>
  Effect.gen(function* () {
    const db = yield* Database;
    const seen: Array<unknown> = [];
    let cursor: string | null = null;
    for (let i = 0; i < 20; i++) {
      const page: ListResult = yield* db.list("posts", {
        ...opts,
        limit: 1,
        cursor: cursor ?? undefined,
      });
      seen.push(...page.documents.map((d) => d.id));
      cursor = page.nextCursor;
      if (cursor === null) break;
    }
    return seen;
  });

describe("Database.list", () => {
  it("returns live rows newest-first, mapping to camelCase documents with parsed JSON", async () => {
    const result = await run(Effect.flatMap(Database, (db) => db.list("posts")));

    expect(result.documents.map((d) => d.id)).toEqual(["p4", "p3", "p2", "p1"]);
    expect(result.nextCursor).toBeNull();

    const first = result.documents[0];
    expect(first).toMatchObject({ id: "p4", title: "Fourth", meta: { tag: "d" }, deletedAt: null });
    expect(typeof first?.createdAt).toBe("number");
  });

  it("excludes soft-deleted rows", async () => {
    const result = await run(Effect.flatMap(Database, (db) => db.list("posts")));
    expect(result.documents.map((d) => d.id)).not.toContain("p5");
  });

  it("paginates via the opaque cursor without overlap", async () => {
    const ids = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        const seen: Array<unknown> = [];
        let cursor: string | null = null;
        for (let i = 0; i < 10; i++) {
          const page: ListResult = yield* db.list("posts", {
            limit: 2,
            cursor: cursor ?? undefined,
          });
          seen.push(...page.documents.map((d) => d.id));
          cursor = page.nextCursor;
          if (cursor === null) break;
        }
        return seen;
      }),
    );
    expect(ids).toEqual(["p4", "p3", "p2", "p1"]);
  });

  it("includes NULL-ordered rows across page boundaries (keyset, NULLS LAST)", async () => {
    // Order by a nullable column: non-null ranks desc, then the NULL partition.
    // The bug this guards against silently dropped the rank=NULL rows (p1, p3).
    const ids = await run(pageThrough({ orderBy: "rank", direction: "desc" }));
    expect(ids).toEqual(["p4", "p2", "p3", "p1"]);
    expect(ids).toContain("p1");
    expect(ids).toContain("p3");
  });

  it("rejects a cursor reused under a different orderBy", async () => {
    const result = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        const page = yield* db.list("posts", { limit: 1 }); // minted under orderBy "id"
        return yield* db
          .list("posts", { limit: 1, cursor: page.nextCursor ?? "", orderBy: "title" })
          .pipe(Effect.either);
      }),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("DatabaseError");
  });

  it("honors orderBy + direction", async () => {
    const result = await run(
      Effect.flatMap(Database, (db) => db.list("posts", { orderBy: "title", direction: "asc" })),
    );
    expect(result.documents.map((d) => d.title)).toEqual(["First", "Fourth", "Second", "Third"]);
  });

  it("clamps the limit and signals more pages", async () => {
    const result = await run(Effect.flatMap(Database, (db) => db.list("posts", { limit: 2 })));
    expect(result.documents).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("fails with DatabaseError for an unknown collection", async () => {
    const result = await run(Effect.flatMap(Database, (db) => db.list("nope")).pipe(Effect.either));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("DatabaseError");
  });

  it("fails with DatabaseError for an unknown orderBy field", async () => {
    const result = await run(
      Effect.flatMap(Database, (db) => db.list("posts", { orderBy: "nope" })).pipe(Effect.either),
    );
    expect(Either.isLeft(result)).toBe(true);
  });
});

describe("Database.get", () => {
  it("returns a mapped document for a live id", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.get("posts", "p2")));
    expect(doc).toMatchObject({ id: "p2", title: "Second", meta: { tag: "b" } });
  });

  it("returns null for a missing id", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.get("posts", "absent")));
    expect(doc).toBeNull();
  });

  it("returns null for a soft-deleted id", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.get("posts", "p5")));
    expect(doc).toBeNull();
  });
});

describe("Database.findOne", () => {
  it("returns the first live row matching a field/value", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.findOne("posts", "title", "Second")));
    expect(doc).toMatchObject({ id: "p2", title: "Second", meta: { tag: "b" } });
  });

  it("returns null when nothing matches", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.findOne("posts", "title", "Nope")));
    expect(doc).toBeNull();
  });

  it("excludes soft-deleted rows", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.findOne("posts", "title", "Gone")));
    expect(doc).toBeNull();
  });

  it("fails with DatabaseError for an unknown field", async () => {
    const result = await run(
      Effect.flatMap(Database, (db) => db.findOne("posts", "nope", "x")).pipe(Effect.either),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("DatabaseError");
  });

  it("fails with DatabaseError for an unknown collection", async () => {
    const result = await run(
      Effect.flatMap(Database, (db) => db.findOne("nope", "title", "x")).pipe(Effect.either),
    );
    expect(Either.isLeft(result)).toBe(true);
  });
});
