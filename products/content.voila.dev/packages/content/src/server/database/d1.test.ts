// `makeD1Driver` against a faithful in-memory D1 binding — a `bun:sqlite`
// connection wrapped in the exact `prepare(sql).bind(...).all()/.run()` async
// contract Cloudflare's `env.DATABASE` exposes. D1 is SQLite under the hood, so
// running the real `Database` through this binding proves the adapter wires the
// driver seam correctly (param binding, result-set shaping, async surface)
// without booting workerd.
//
// The live-workerd check (Miniflare) is intentionally not run here: its current
// build is incompatible with Bun's timer teardown. This binding shares D1's API
// and storage engine, so it covers the adapter's behaviour identically.

import { Database as Sqlite } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { type D1Binding, type D1PreparedStatement, makeD1Driver } from "./d1-driver";
import { DatabaseError, makeDatabase } from "./database";
import type { SqlValue } from "./driver";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

// The two-field `posts` table as `deriveSchema` would render it for SQLite/D1.
const SCHEMA = `CREATE TABLE "posts" (
  "id" TEXT PRIMARY KEY,
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "title" TEXT,
  "views" REAL
)`;

// A `D1Binding` backed by `bun:sqlite`, mirroring D1's prepare→bind→all/run shape.
function fakeD1(db: Sqlite): D1Binding {
  return {
    prepare(query: string): D1PreparedStatement {
      let bound: ReadonlyArray<SqlValue> = [];
      const stmt: D1PreparedStatement = {
        bind(...values: ReadonlyArray<SqlValue>): D1PreparedStatement {
          bound = values;
          return stmt;
        },
        all<T = Record<string, unknown>>(): Promise<{ readonly results: ReadonlyArray<T> }> {
          return Promise.resolve({ results: db.query(query).all(...bound) as Array<T> });
        },
        run(): Promise<unknown> {
          db.query(query).run(...bound);
          return Promise.resolve({});
        },
      };
      return stmt;
    },
  };
}

function freshDb(): ReturnType<typeof makeDatabase> {
  const sqlite = new Sqlite(":memory:");
  sqlite.run(SCHEMA);
  const driver = makeD1Driver(fakeD1(sqlite));
  return makeDatabase(config, driver);
}

describe("makeD1Driver — Database over a D1-shaped binding", () => {
  it("serves list/get/findOne over the binding", async () => {
    const db = freshDb();
    await db.create("posts", { title: "Hello", views: 7 });
    await db.create("posts", { title: "World", views: 9 });

    const page = await db.list("posts", { limit: 10 });
    expect(page.documents).toHaveLength(2);
    expect(page.documents.map((d) => d.title)).toContain("World");

    const world = await db.findOne("posts", "title", "World");
    expect(world).toMatchObject({ title: "World", views: 9 });
    expect(await db.get("posts", world?.id as string)).toMatchObject({ title: "World" });
    expect(await db.get("posts", "absent")).toBeNull();
  });

  it("writes through the binding and echoes the stored row", async () => {
    const db = freshDb();
    const created = await db.create("posts", { title: "Fresh", views: 1 });
    expect(typeof created.id).toBe("string");
    expect(await db.get("posts", created.id as string)).toMatchObject({ title: "Fresh" });
  });

  it("surfaces a typed DatabaseError over the binding", async () => {
    const db = freshDb();
    let error: unknown;
    try {
      await db.list("nope");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DatabaseError);
  });
});
