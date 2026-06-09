// REST write layer over a real (in-memory) SQLite `Database`, driven through the
// `createRestHandler` dispatcher so routing, body parsing, validation, envelope
// shaping, and conflict/not-found mapping are exercised end to end. The table is
// rendered straight from `deriveSchema` (same approach as the read suite) so a
// real UNIQUE index backs the CONFLICT path.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeDatabase } from "../database/database";
import { makeSqliteDriver, type SqliteDriver } from "../database/sqlite-driver";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.slug({ unique: true }),
    rank: fields.number(),
    // A nested object field so an invalid member yields a multi-segment issue path.
    info: fields.object({ name: fields.string() }),
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
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  driver = makeSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = { config, database: makeDatabase(config, driver) };
  handle = createRestHandler(ctx, { basePath: "/admin/api" });
});

interface SendInit {
  readonly method: string;
  readonly body?: unknown;
}

async function send(path: string, init: SendInit): Promise<Response> {
  const request =
    init.body === undefined
      ? new Request(`https://x${path}`, { method: init.method })
      : new Request(`https://x${path}`, {
          method: init.method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(init.body),
        });
  const response = await handle(request);
  if (response === null) throw new Error(`route not matched: ${init.method} ${path}`);
  return response;
}

async function dataOf<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

async function failureOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

// Create a document, asserting 201, and return its row.
async function create(
  data: Record<string, unknown>,
): Promise<{ id: string } & Record<string, unknown>> {
  const response = await send("/admin/api/posts", { method: "POST", body: { data } });
  expect(response.status).toBe(201);
  return dataOf(response);
}

describe("create — POST /:collection", () => {
  it("creates a document and echoes the stored row with system columns", async () => {
    const response = await send("/admin/api/posts", {
      method: "POST",
      body: { data: { title: "Hello", slug: "hello", rank: 3 } },
    });
    expect(response.status).toBe(201);
    const row = await dataOf<Record<string, unknown>>(response);
    expect(row).toMatchObject({ title: "Hello", slug: "hello", rank: 3, deletedAt: null });
    expect(typeof row.id).toBe("string");
    expect(typeof row.createdAt).toBe("number");

    // Persisted: readable through the read path.
    const read = await send(`/admin/api/posts/${row.id}`, { method: "GET" });
    expect((await dataOf<{ title: string }>(read)).title).toBe("Hello");
  });

  it("ignores client-sent system columns (id/createdAt are server-owned)", async () => {
    const row = await create({ title: "X", slug: "x", id: "forged", createdAt: 1 });
    expect(row.id).not.toBe("forged");
    expect(row.createdAt).not.toBe(1);
  });

  it("rejects a missing required field with 422 VALIDATION", async () => {
    const response = await send("/admin/api/posts", {
      method: "POST",
      body: { data: { slug: "no-title" } },
    });
    expect(response.status).toBe(422);
    const failure = await failureOf(response);
    expect(failure).toMatchObject({ code: "VALIDATION", collectionSlug: "posts" });
    expect((failure as { issues: Array<{ path: string[] }> }).issues).toContainEqual(
      expect.objectContaining({ path: ["title"] }),
    );
  });

  it("rejects a wrong-typed field with 422 VALIDATION carrying the field path", async () => {
    const response = await send("/admin/api/posts", {
      method: "POST",
      body: { data: { title: "ok", rank: "not-a-number" } },
    });
    expect(response.status).toBe(422);
    const failure = (await failureOf(response)) as { issues: Array<{ path: string[] }> };
    expect(failure.issues).toContainEqual(expect.objectContaining({ path: ["rank"] }));
  });

  it("reports a nested object failure with a multi-segment issue path", async () => {
    const response = await send("/admin/api/posts", {
      method: "POST",
      body: { data: { title: "ok", info: { name: 123 } } },
    });
    expect(response.status).toBe(422);
    const failure = (await failureOf(response)) as {
      issues: Array<{ path: Array<string | number> }>;
    };
    expect(failure.issues).toContainEqual(expect.objectContaining({ path: ["info", "name"] }));
  });

  it("rejects an unknown field with 422 VALIDATION", async () => {
    const response = await send("/admin/api/posts", {
      method: "POST",
      body: { data: { title: "ok", nope: 1 } },
    });
    expect(response.status).toBe(422);
    const failure = (await failureOf(response)) as { issues: Array<{ path: string[] }> };
    expect(failure.issues).toContainEqual(expect.objectContaining({ path: ["nope"] }));
  });

  it("maps a unique-constraint violation to 409 CONFLICT naming the field", async () => {
    await create({ title: "One", slug: "dup" });
    const response = await send("/admin/api/posts", {
      method: "POST",
      body: { data: { title: "Two", slug: "dup" } },
    });
    expect(response.status).toBe(409);
    expect(await failureOf(response)).toMatchObject({
      code: "CONFLICT",
      collectionSlug: "posts",
      field: "slug",
    });
  });

  it("rejects a malformed JSON body with 400 BAD_REQUEST", async () => {
    const response = await handle(
      new Request("https://x/admin/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      }),
    );
    expect(response?.status).toBe(400);
  });

  it("rejects a body without a `data` object with 400 BAD_REQUEST", async () => {
    const response = await send("/admin/api/posts", { method: "POST", body: { notData: 1 } });
    expect(response.status).toBe(400);
    expect(await failureOf(response)).toMatchObject({
      code: "BAD_REQUEST",
      details: { field: "data" },
    });
  });

  it("rejects an unknown collection with 404 UNKNOWN_COLLECTION", async () => {
    const response = await send("/admin/api/nope", { method: "POST", body: { data: {} } });
    expect(response.status).toBe(404);
    expect(await failureOf(response)).toMatchObject({ code: "UNKNOWN_COLLECTION" });
  });
});

describe("update — PATCH /:collection/:id", () => {
  it("patches a subset of fields and bumps updatedAt", async () => {
    const created = await create({ title: "Before", slug: "u1", rank: 1 });
    const response = await send(`/admin/api/posts/${created.id}`, {
      method: "PATCH",
      body: { data: { rank: 9 } },
    });
    expect(response.status).toBe(200);
    const row = await dataOf<Record<string, unknown>>(response);
    // Untouched fields survive a partial patch.
    expect(row).toMatchObject({ title: "Before", slug: "u1", rank: 9 });
    expect(row.updatedAt as number).toBeGreaterThanOrEqual(created.createdAt as number);
  });

  it("allows omitting a required field on a partial update", async () => {
    const created = await create({ title: "Keep", slug: "u2" });
    const response = await send(`/admin/api/posts/${created.id}`, {
      method: "PATCH",
      body: { data: { rank: 4 } },
    });
    expect(response.status).toBe(200);
  });

  it("returns 404 NOT_FOUND for a missing id", async () => {
    const response = await send("/admin/api/posts/absent", {
      method: "PATCH",
      body: { data: { rank: 1 } },
    });
    expect(response.status).toBe(404);
    expect(await failureOf(response)).toEqual({ code: "NOT_FOUND", collectionSlug: "posts" });
  });

  it("rejects an invalid patch value with 422 VALIDATION", async () => {
    const created = await create({ title: "V", slug: "u3" });
    const response = await send(`/admin/api/posts/${created.id}`, {
      method: "PATCH",
      body: { data: { rank: "bad" } },
    });
    expect(response.status).toBe(422);
  });

  it("maps a unique collision on update to 409 CONFLICT", async () => {
    await create({ title: "A", slug: "taken" });
    const second = await create({ title: "B", slug: "free" });
    const response = await send(`/admin/api/posts/${second.id}`, {
      method: "PATCH",
      body: { data: { slug: "taken" } },
    });
    expect(response.status).toBe(409);
    expect(await failureOf(response)).toMatchObject({ code: "CONFLICT", field: "slug" });
  });
});

describe("delete — DELETE /:collection/:id", () => {
  it("soft-deletes a live row; it then 404s and drops from the list", async () => {
    const created = await create({ title: "Doomed", slug: "d1" });
    const response = await send(`/admin/api/posts/${created.id}`, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await dataOf<{ id: string }>(response)).toEqual({ id: created.id });

    expect((await send(`/admin/api/posts/${created.id}`, { method: "GET" })).status).toBe(404);
    const list = await dataOf<Array<{ id: string }>>(
      await send("/admin/api/posts", { method: "GET" }),
    );
    expect(list.map((d) => d.id)).not.toContain(created.id);
  });

  it("returns 404 NOT_FOUND for a missing or already-deleted row", async () => {
    expect((await send("/admin/api/posts/absent", { method: "DELETE" })).status).toBe(404);
    const created = await create({ title: "Once", slug: "d2" });
    await send(`/admin/api/posts/${created.id}`, { method: "DELETE" });
    expect((await send(`/admin/api/posts/${created.id}`, { method: "DELETE" })).status).toBe(404);
  });
});

describe("restore — POST /:collection/:id/restore", () => {
  it("restores a soft-deleted row and clears deletedAt", async () => {
    const created = await create({ title: "Back", slug: "r1" });
    await send(`/admin/api/posts/${created.id}`, { method: "DELETE" });

    const response = await send(`/admin/api/posts/${created.id}/restore`, { method: "POST" });
    expect(response.status).toBe(200);
    const row = await dataOf<Record<string, unknown>>(response);
    expect(row).toMatchObject({ id: created.id, title: "Back", deletedAt: null });
    // Readable again.
    expect((await send(`/admin/api/posts/${created.id}`, { method: "GET" })).status).toBe(200);
  });

  it("returns 404 NOT_FOUND restoring a live (never-deleted) row", async () => {
    const created = await create({ title: "Live", slug: "r2" });
    expect((await send(`/admin/api/posts/${created.id}/restore`, { method: "POST" })).status).toBe(
      404,
    );
  });

  it("returns 404 NOT_FOUND restoring a missing row", async () => {
    expect((await send("/admin/api/posts/absent/restore", { method: "POST" })).status).toBe(404);
  });
});

describe("router — write shapes", () => {
  it("returns null for write methods on an unmatched shape", async () => {
    // DELETE needs an id segment.
    expect(await handle(new Request("https://x/admin/api/posts", { method: "DELETE" }))).toBeNull();
    // POST restore needs exactly `/:id/restore`.
    expect(
      await handle(new Request("https://x/admin/api/posts/p1/nope", { method: "POST" })),
    ).toBeNull();
    // PATCH needs exactly `/:collection/:id`.
    expect(await handle(new Request("https://x/admin/api/posts", { method: "PATCH" }))).toBeNull();
  });
});

// `posts` here is NOT draft-enabled — these assert the publish routes degrade
// safely (400) rather than 500, and that `?status` is validated.
describe("publish — non-draft collection + validation", () => {
  it("publishing a non-draft collection is a 400 BAD_REQUEST", async () => {
    const post = await create({ title: "X", slug: "x" });
    const response = await send(`/admin/api/posts/${post.id}/publish`, { method: "POST" });
    expect(response.status).toBe(400);
    expect((await failureOf(response)).code).toBe("BAD_REQUEST");
  });

  it("unpublishing a non-draft collection is a 400 BAD_REQUEST", async () => {
    const post = await create({ title: "X", slug: "x" });
    const response = await send(`/admin/api/posts/${post.id}/unpublish`, { method: "POST" });
    expect(response.status).toBe(400);
  });

  it("rejects an invalid publish `at` with 400", async () => {
    const post = await create({ title: "X", slug: "x" });
    const response = await send(`/admin/api/posts/${post.id}/publish`, {
      method: "POST",
      body: { at: "soon" },
    });
    expect(response.status).toBe(400);
  });

  it("rejects an invalid ?status filter with 400", async () => {
    const response = await send("/admin/api/posts?status=bogus", { method: "GET" });
    expect(response.status).toBe(400);
    expect((await failureOf(response)).code).toBe("BAD_REQUEST");
  });
});
