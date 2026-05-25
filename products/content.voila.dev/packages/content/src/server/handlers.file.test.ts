/**
 * REST read-path integration against a *real on-disk SQLite file*, created in a
 * fresh temp directory and torn down per test (roadmap M1 testing bar).
 *
 * The sibling `handlers.test.ts` exercises the same handlers against an
 * in-memory database; this suite proves the read path works end-to-end against
 * a file-backed driver and that nothing leaks between tests — each test gets a
 * brand-new file, and `afterEach` removes it.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqlite } from "@voila/content-database/sqlite";
import { fields } from "@voila/content-schema";
import { sql } from "drizzle-orm";
import { defineCollection, defineContent } from "../define.ts";
import { handleFindByField, handleFindById, handleList } from "./handlers/index.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string({ required: true, unique: true }),
    views: fields.number({ integer: true }),
  },
});

const content = defineContent({ collections: [posts] });

// Mirrors what `voila migrate apply` would write for this collection.
const DDL = `
  CREATE TABLE "posts" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    "deleted_at" INTEGER,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "views" INTEGER
  )
`;

let dir: string;
let dbPath: string;
let adapter: ReturnType<typeof sqlite>;

beforeEach(() => {
  // A new temp directory (and therefore a new database file) per test.
  dir = mkdtempSync(join(tmpdir(), "voila-rest-"));
  dbPath = join(dir, "content.sqlite");
  adapter = sqlite({ url: dbPath });
  adapter.drizzle.run(sql.raw(DDL));
});

afterEach(() => {
  adapter.close?.();
  rmSync(dir, { recursive: true, force: true });
});

function seed(rows: ReadonlyArray<{ id: string; createdAt: number; title: string; slug: string }>) {
  for (const r of rows) {
    adapter.drizzle.run(
      sql.raw(
        `INSERT INTO "posts" ("id","created_at","title","slug") VALUES ('${r.id}',${r.createdAt},'${r.title}','${r.slug}')`,
      ),
    );
  }
}

const SEED = [
  { id: "p1", createdAt: 1000, title: "First", slug: "first" },
  { id: "p2", createdAt: 2000, title: "Second", slug: "second" },
  { id: "p3", createdAt: 3000, title: "Third", slug: "third" },
];

function req(path: string): Request {
  return new Request(`http://localhost/admin/api${path}`);
}

async function json(res: Response): Promise<{ status: number; body: any }> {
  return { status: res.status, body: await res.json() };
}

describe("REST read path against a real SQLite file", () => {
  test("the database is a real file on disk inside the OS temp dir", () => {
    expect(existsSync(dbPath)).toBe(true);
    expect(dbPath.startsWith(tmpdir())).toBe(true);
  });

  test("list returns the success envelope { data, nextCursor }", async () => {
    seed(SEED);
    const { status, body } = await json(
      await handleList({
        request: req("/posts"),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(200);
    // Default order is createdAt desc.
    expect(body.data.map((r: { id: string }) => r.id)).toEqual(["p3", "p2", "p1"]);
    expect(body.nextCursor).toBeNull();
    // Envelope contract: exactly `data` + `nextCursor`, no error key.
    expect(Object.keys(body).sort()).toEqual(["data", "nextCursor"]);
  });

  test("paginates with an opaque cursor over the file", async () => {
    seed(SEED);
    const first = await json(
      await handleList({
        request: req("/posts?limit=2"),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(first.body.data.map((r: { id: string }) => r.id)).toEqual(["p3", "p2"]);
    expect(first.body.nextCursor).toBeString();

    const second = await json(
      await handleList({
        request: req(`/posts?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(second.body.data.map((r: { id: string }) => r.id)).toEqual(["p1"]);
    expect(second.body.nextCursor).toBeNull();
  });

  test("findById and findByField read back the seeded row", async () => {
    seed(SEED);
    const byId = await json(
      await handleFindById({
        request: req("/posts/p2"),
        params: { collection: "posts", id: "p2" },
        content,
        adapter,
      }),
    );
    expect(byId.status).toBe(200);
    expect(byId.body.data.slug).toBe("second");

    const byField = await json(
      await handleFindByField({
        request: req("/posts/by/slug/third"),
        params: { collection: "posts", field: "slug", value: "third" },
        content,
        adapter,
      }),
    );
    expect(byField.status).toBe(200);
    expect(byField.body.data.id).toBe("p3");
  });

  test("errors use the { error: { code, message } } envelope", async () => {
    const { status, body } = await json(
      await handleList({
        request: req("/ghosts"),
        params: { collection: "ghosts" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("UNKNOWN_COLLECTION");
    // The envelope carries the discriminator plus the error's structured
    // fields (here the offending slug); there is no top-level `data` key.
    expect(body.error.slug).toBe("ghosts");
    expect(body).not.toHaveProperty("data");
  });

  test("each test gets a fresh file — no rows leak across the teardown", async () => {
    // This test seeds nothing; if the previous test's writes survived, the
    // list would be non-empty. A clean file per `beforeEach` keeps it empty.
    const { body } = await json(
      await handleList({
        request: req("/posts"),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(body.data).toEqual([]);
  });
});
