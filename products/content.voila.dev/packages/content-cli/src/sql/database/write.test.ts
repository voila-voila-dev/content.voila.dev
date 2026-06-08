// `Database` write methods over real (in-memory) SQLite: create fills system
// columns and echoes the stored row, update bumps `updatedAt` and is scoped to live
// rows, soft-delete hides a row while hard-delete purges it, restore revives a
// soft-deleted row, and a unique violation surfaces as `DatabaseError { conflict }`.

import { beforeEach, describe, expect, it } from "bun:test";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect } from "effect";
import { defineConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { SqliteLive } from "../client/sqlite";
import { deriveSchema } from "../ddl/derive-schema";
import { generateDDL } from "../ddl/generate-ddl";
import { splitStatements } from "../migrator/loader";
import { makeDatabaseLayer } from "./database";
import { Database } from "./types";

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

// Each spec gets a fresh in-memory DB seeded with the collection DDL.
const run = <A>(effect: Effect.Effect<A, unknown, Database>): Promise<A> => {
  const ddl = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
  const seed = Effect.gen(function* () {
    const sql = yield* SqlClient;
    for (const statement of ddl) yield* sql.unsafe(statement);
  });
  const database = makeDatabaseLayer(config);
  return Effect.runPromise(
    seed.pipe(
      Effect.zipRight(effect.pipe(Effect.provide(database))),
      Effect.scoped,
      Effect.provide(SqliteLive({ url: ":memory:" })),
    ) as Effect.Effect<A, unknown, never>,
  );
};

let counter = 0;
const draft = () => ({ title: "Hello", slug: `hello-${counter++}`, views: 0, published: false });

describe("Database write methods", () => {
  beforeEach(() => {
    counter = 0;
  });

  it("create fills system columns and returns the stored row", async () => {
    const doc = await run(Effect.flatMap(Database, (db) => db.create("posts", draft())));
    expect(typeof doc.id).toBe("string");
    expect((doc.id as string).length).toBeGreaterThan(0);
    expect(doc.title).toBe("Hello");
    expect(doc.published).toBe(false); // 0 → boolean on read
    expect(typeof doc.createdAt).toBe("number");
    expect(doc.deletedAt).toBeNull();
  });

  it("update patches supplied fields, bumps updatedAt, leaves the rest", async () => {
    const updated = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        const created = yield* db.create("posts", draft());
        const next = yield* db.update("posts", created.id as string, {
          title: "Edited",
          published: true,
        });
        return { created, next };
      }),
    );
    expect(updated.next?.title).toBe("Edited");
    expect(updated.next?.published).toBe(true);
    expect(updated.next?.slug).toBe("hello-0"); // untouched
    expect(updated.next?.updatedAt as number).toBeGreaterThanOrEqual(
      updated.created.updatedAt as number,
    );
  });

  it("update returns null for a missing row", async () => {
    const result = await run(
      Effect.flatMap(Database, (db) => db.update("posts", "nope", { title: "x" })),
    );
    expect(result).toBeNull();
  });

  it("soft-delete hides the row from reads; restore brings it back", async () => {
    const result = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        const created = yield* db.create("posts", draft());
        const deleted = yield* db.softDelete("posts", created.id as string);
        const afterDelete = yield* db.get("posts", created.id as string);
        const restored = yield* db.restore("posts", created.id as string);
        const afterRestore = yield* db.get("posts", created.id as string);
        return { deleted, afterDelete, restored, afterRestore };
      }),
    );
    expect(result.deleted).toBe(true);
    expect(result.afterDelete).toBeNull(); // hidden
    expect(result.restored?.title).toBe("Hello");
    expect(result.afterRestore).not.toBeNull(); // live again
  });

  it("hard-delete purges even a soft-deleted row", async () => {
    const result = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        const created = yield* db.create("posts", draft());
        yield* db.softDelete("posts", created.id as string);
        const purged = yield* db.hardDelete("posts", created.id as string);
        const restored = yield* db.restore("posts", created.id as string);
        return { purged, restored };
      }),
    );
    expect(result.purged).toBe(true);
    expect(result.restored).toBeNull(); // nothing left to restore
  });

  it("a unique violation surfaces as a conflict with the offending field", async () => {
    const error = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        yield* db.create("posts", { title: "A", slug: "dupe", views: 0, published: false });
        return yield* db
          .create("posts", { title: "B", slug: "dupe", views: 0, published: false })
          .pipe(Effect.flip);
      }),
    );
    expect((error as { conflict?: boolean }).conflict).toBe(true);
    expect((error as { field?: string }).field).toBe("slug");
  });
});
