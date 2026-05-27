/**
 * REST write-path integration against an in-memory SQLite database. Mirrors
 * `handlers.test.ts` (read path): builds real `Request`s, drives the handlers,
 * and asserts the success/error envelopes. The DDL carries the same DB-level
 * defaults `voila migrate apply` would emit, so `POST` exercises real
 * server-side id + timestamp generation.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { sqlite } from "@voila/content-database/sqlite";
import { fields } from "@voila/content-schema";
import { sql } from "drizzle-orm";
import { defineCollection, defineContent } from "../define.ts";
import { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken } from "./csrf.ts";
import { handleCreate, handleDelete, handleRestore, handleUpdate } from "./handlers/index.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true, min: 3 }),
    slug: fields.string({ required: true, unique: true }),
    views: fields.number({ integer: true, default: 0 }),
    published: fields.boolean(),
  },
});

const content = defineContent({ collections: [posts] });

// A canonical UUID-v4 expression matching what the schema generator emits, so
// inserts that omit `id` get one from the DB just like in production.
const UUID = `(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))`;

const DDL = `
  CREATE TABLE "posts" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT ${UUID},
    "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    "deleted_at" INTEGER,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "views" INTEGER DEFAULT 0,
    "published" INTEGER
  )
`;

// CSRF tokens are HMAC-signed; verification uses the same secret the write ctx
// carries. Generate a real signed token once for the cookie/header pair.
const SECRET = "test-csrf-secret";
let TOKEN: string;
beforeAll(async () => {
  TOKEN = await generateCsrfToken(SECRET);
});

// happy-dom (preloaded for the package's component tests) drops the `Cookie`
// header from its DOM `Request` per browser forbidden-header rules, which the
// CSRF check needs. `test/setup.ts` preserves the runtime's native `Request`
// under `globalThis.NativeRequest`; use it so requests carry their cookie.
const RealRequest = (globalThis as { NativeRequest?: typeof Request }).NativeRequest ?? Request;

let adapter: ReturnType<typeof sqlite>;

beforeEach(() => {
  adapter = sqlite({ url: ":memory:" });
  adapter.drizzle.run(sql.raw(DDL));
});

afterEach(() => adapter.close?.());

function seed(
  rows: ReadonlyArray<{ id: string; title: string; slug: string; deletedAt?: number }>,
) {
  for (const r of rows) {
    adapter.drizzle.run(
      sql.raw(
        `INSERT INTO "posts" ("id","created_at","updated_at","deleted_at","title","slug","views") VALUES ('${r.id}',1000,1000,${r.deletedAt ?? "NULL"},'${r.title}','${r.slug}',5)`,
      ),
    );
  }
}

/** Build a state-changing request carrying a matching CSRF cookie + header. */
function writeReq(
  method: string,
  path: string,
  options: { body?: unknown; csrf?: boolean | { cookie?: string; header?: string } } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  const csrf = options.csrf ?? true;
  if (csrf === true) {
    headers.set("cookie", `${CSRF_COOKIE}=${TOKEN}`);
    headers.set(CSRF_HEADER, TOKEN);
  } else if (csrf && typeof csrf === "object") {
    if (csrf.cookie) headers.set("cookie", `${CSRF_COOKIE}=${csrf.cookie}`);
    if (csrf.header) headers.set(CSRF_HEADER, csrf.header);
  }
  return new RealRequest(`http://localhost/admin/api${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function json(res: Response): Promise<{ status: number; body: any }> {
  return { status: res.status, body: await res.json() };
}

/** Count rows for an id straight from the table (ignores soft-delete). */
function countRows(id: string): number {
  const rows = adapter.drizzle.all<{ c: number }>(
    sql.raw(`SELECT count(*) as c FROM "posts" WHERE "id" = '${id}'`),
  );
  return rows[0]?.c ?? 0;
}

describe("handleCreate", () => {
  function create(body: unknown, opts?: { csrf?: boolean }) {
    return handleCreate({
      request: writeReq("POST", "/posts", { body, csrf: opts?.csrf }),
      params: { collection: "posts" },
      content,
      adapter,
      csrfSecret: SECRET,
    });
  }

  test("creates a row, returns 201 with DB-generated id + timestamps", async () => {
    const { status, body } = await json(await create({ title: "Hello", slug: "hello" }));
    expect(status).toBe(201);
    expect(body.data.id).toBeString();
    expect(body.data.id.length).toBeGreaterThan(0);
    expect(body.data.title).toBe("Hello");
    expect(body.data.views).toBe(0); // schema default applied by validation
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.deletedAt).toBeNull();
  });

  test("422s with per-field messages on invalid input", async () => {
    const { status, body } = await json(await create({ title: "no" })); // too short + missing slug
    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.fields.title).toBeDefined();
    expect(body.error.fields.slug).toBeDefined();
  });

  test("409s on a unique-constraint violation, naming the field", async () => {
    seed([{ id: "p1", title: "First", slug: "taken" }]);
    const { status, body } = await json(await create({ title: "Another", slug: "taken" }));
    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.field).toBe("slug");
  });

  test("404s on an unknown collection", async () => {
    const { status, body } = await json(
      await handleCreate({
        request: writeReq("POST", "/ghosts", { body: { title: "x" } }),
        params: { collection: "ghosts" },
        content,
        adapter,
        csrfSecret: SECRET,
      }),
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("UNKNOWN_COLLECTION");
  });

  test("400s on a non-object / malformed body", async () => {
    const { status, body } = await json(
      await handleCreate({
        request: new RealRequest("http://localhost/admin/api/posts", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${CSRF_COOKIE}=${TOKEN}`,
            [CSRF_HEADER]: TOKEN,
          },
          body: "not json",
        }),
        params: { collection: "posts" },
        content,
        adapter,
        csrfSecret: SECRET,
      }),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("403s when the CSRF token is missing", async () => {
    const { status, body } = await json(
      await create({ title: "Hello", slug: "hello" }, { csrf: false }),
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe("CSRF");
  });
});

describe("handleUpdate", () => {
  beforeEach(() => seed([{ id: "p1", title: "First", slug: "first" }]));

  function update(id: string, body: unknown) {
    return handleUpdate({
      request: writeReq("PATCH", `/posts/${id}`, { body }),
      params: { collection: "posts", id },
      content,
      adapter,
      csrfSecret: SECRET,
    });
  }

  test("applies a partial patch and bumps updatedAt, leaving other fields intact", async () => {
    const { status, body } = await json(await update("p1", { title: "Renamed" }));
    expect(status).toBe(200);
    expect(body.data.title).toBe("Renamed");
    expect(body.data.slug).toBe("first"); // untouched
    expect(new Date(body.data.updatedAt).getTime()).toBeGreaterThan(1000);
  });

  test("422s on an explicitly-supplied invalid value", async () => {
    const { status, body } = await json(await update("p1", { title: "no" }));
    expect(status).toBe(422);
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.fields.title).toBeDefined();
  });

  test("400s on an empty patch (no updatable fields)", async () => {
    const { status, body } = await json(await update("p1", { rogue: "x" }));
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("404s for a missing id", async () => {
    const { status, body } = await json(await update("nope", { title: "Renamed" }));
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("404s for a soft-deleted id", async () => {
    adapter.drizzle.run(sql.raw(`UPDATE "posts" SET "deleted_at" = 9999 WHERE "id" = 'p1'`));
    const { status } = await json(await update("p1", { title: "Renamed" }));
    expect(status).toBe(404);
  });

  test("409s when a patch collides with another row's unique value", async () => {
    seed([{ id: "p2", title: "Second", slug: "second" }]);
    const { status, body } = await json(await update("p1", { slug: "second" }));
    expect(status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.field).toBe("slug");
  });

  test("403s without a CSRF token", async () => {
    const { status, body } = await json(
      await handleUpdate({
        request: writeReq("PATCH", "/posts/p1", { body: { title: "Renamed" }, csrf: false }),
        params: { collection: "posts", id: "p1" },
        content,
        adapter,
        csrfSecret: SECRET,
      }),
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe("CSRF");
  });
});

describe("handleDelete", () => {
  beforeEach(() => seed([{ id: "p1", title: "First", slug: "first" }]));

  function del(id: string, query = "") {
    return handleDelete({
      request: writeReq("DELETE", `/posts/${id}${query}`),
      params: { collection: "posts", id },
      content,
      adapter,
      csrfSecret: SECRET,
    });
  }

  test("soft-deletes by default: stamps deletedAt, row survives in the table", async () => {
    const { status, body } = await json(await del("p1"));
    expect(status).toBe(200);
    expect(body.data.deletedAt).not.toBeNull();
    expect(countRows("p1")).toBe(1); // still present, just flagged
  });

  test("404s when deleting an already soft-deleted row", async () => {
    await del("p1");
    const { status } = await json(await del("p1"));
    expect(status).toBe(404);
  });

  test("404s for a missing id", async () => {
    const { status, body } = await json(await del("nope"));
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("?hard=true purges the row from the table", async () => {
    const { status } = await json(await del("p1", "?hard=true"));
    expect(status).toBe(200);
    expect(countRows("p1")).toBe(0); // gone for good
  });

  test("403s without a CSRF token", async () => {
    const { status, body } = await json(
      await handleDelete({
        request: writeReq("DELETE", "/posts/p1", { csrf: false }),
        params: { collection: "posts", id: "p1" },
        content,
        adapter,
        csrfSecret: SECRET,
      }),
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe("CSRF");
  });
});

describe("handleRestore", () => {
  function restore(id: string) {
    return handleRestore({
      request: writeReq("POST", `/posts/${id}/restore`),
      params: { collection: "posts", id },
      content,
      adapter,
      csrfSecret: SECRET,
    });
  }

  test("clears deletedAt on a soft-deleted row", async () => {
    seed([{ id: "p1", title: "First", slug: "first", deletedAt: 9999 }]);
    const { status, body } = await json(await restore("p1"));
    expect(status).toBe(200);
    expect(body.data.deletedAt).toBeNull();
  });

  test("404s when restoring a live (non-deleted) row", async () => {
    seed([{ id: "p1", title: "First", slug: "first" }]);
    const { status, body } = await json(await restore("p1"));
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("404s for a missing id", async () => {
    const { status } = await json(await restore("nope"));
    expect(status).toBe(404);
  });

  test("403s without a CSRF token", async () => {
    seed([{ id: "p1", title: "First", slug: "first", deletedAt: 9999 }]);
    const { status, body } = await json(
      await handleRestore({
        request: writeReq("POST", "/posts/p1/restore", { csrf: false }),
        params: { collection: "posts", id: "p1" },
        content,
        adapter,
        csrfSecret: SECRET,
      }),
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe("CSRF");
  });
});
