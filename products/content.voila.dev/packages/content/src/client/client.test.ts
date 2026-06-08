// The typed client end to end: `makeClient` is wired to the real REST
// `createRestHandler` dispatcher (over an in-memory `bun:sqlite` Database) by
// injecting a `fetch` that routes Requests straight into the handler. So every
// method exercises the full stack — URL building, envelope unwrapping, typed
// errors — against the same code that serves production. Types are checked by
// `tsc` compiling this file (see `typeChecks` / `returnTypes` below).

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeDatabase } from "../server/database/database";
import { makeSqliteDriver } from "../server/database/sqlite-driver";
import { createRestHandler, type RestContext } from "../server/rest";
import { deriveSchema } from "../sql";
import {
  type ContentClient,
  ContentClientError,
  isContentClientError,
  makeClient,
  type Stored,
} from "./index";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.slug({ unique: true }),
    rank: fields.number(),
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

let client: ContentClient<typeof config>;

beforeEach(async () => {
  const driver = makeSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = { config, database: makeDatabase(config, driver) };
  const handle = createRestHandler(ctx, { basePath: "/admin/api" });

  // Route the client's fetch into the dispatcher; an unmatched route (handle →
  // null) shouldn't happen for client-issued URLs, so surface it as a 500.
  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await handle(new Request(input as string, init));
    return (
      response ?? new Response(JSON.stringify({ error: { code: "INTERNAL" } }), { status: 500 })
    );
  };

  client = makeClient(config, { baseUrl: "https://x/admin/api", fetch: fetchImpl });
});

describe("create", () => {
  it("creates a row and returns it typed with system columns", async () => {
    const post = await client.posts.create({ title: "Hello", slug: "hello", rank: 1 });
    expect(post).toMatchObject({ title: "Hello", slug: "hello", rank: 1, deletedAt: null });
    // `post.id` / `post.createdAt` are typed (System columns) — compiles ⇒ typed.
    expect(typeof post.id).toBe("string");
    expect(typeof post.createdAt).toBe("number");
  });

  it("throws a typed CONFLICT on a unique collision", async () => {
    await client.posts.create({ title: "One", slug: "dup", rank: 1 });
    const error = await client.posts.create({ title: "Two", slug: "dup", rank: 2 }).catch((e) => e);
    expect(isContentClientError(error)).toBe(true);
    expect(error).toBeInstanceOf(ContentClientError);
    expect((error as ContentClientError).status).toBe(409);
    expect((error as ContentClientError).failure).toMatchObject({
      code: "CONFLICT",
      field: "slug",
    });
  });

  it("throws a typed VALIDATION when the payload is invalid", async () => {
    // Bypass the compile-time guard to drive the server's runtime validation.
    const error = await client.posts.create({ slug: "no-title" } as never).catch((e) => e);
    expect((error as ContentClientError).status).toBe(422);
    expect((error as ContentClientError).failure.code).toBe("VALIDATION");
  });
});

describe("read", () => {
  it("find returns the row, or null when missing/soft-deleted", async () => {
    const created = await client.posts.create({ title: "F", slug: "f", rank: 1 });
    const found = await client.posts.find(created.id);
    expect(found?.title).toBe("F");
    expect(await client.posts.find("absent")).toBeNull();
  });

  it("findBy resolves a unique field, or null when none match", async () => {
    await client.posts.create({ title: "B", slug: "by-me", rank: 1 });
    expect((await client.posts.findBy("slug", "by-me"))?.title).toBe("B");
    expect(await client.posts.findBy("slug", "nope")).toBeNull();
  });

  it("list paginates via nextCursor without overlap", async () => {
    for (const n of [1, 2, 3]) {
      await client.posts.create({ title: `P${n}`, slug: `p${n}`, rank: n });
    }
    const first = await client.posts.list({ limit: 2, orderBy: "rank", order: "asc" });
    expect(first.data.map((d) => d.rank)).toEqual([1, 2]);
    expect(first.nextCursor).not.toBeNull();

    const second = await client.posts.list({
      limit: 2,
      orderBy: "rank",
      order: "asc",
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.data.map((d) => d.rank)).toEqual([3]);
    expect(second.nextCursor).toBeNull();
  });
});

describe("update / delete / restore", () => {
  it("update patches a subset and returns the stored row", async () => {
    const created = await client.posts.create({ title: "Before", slug: "u", rank: 1 });
    const updated = await client.posts.update(created.id, { rank: 9 });
    expect(updated).toMatchObject({ title: "Before", slug: "u", rank: 9 });
  });

  it("update throws NOT_FOUND for a missing id", async () => {
    const error = await client.posts.update("absent", { rank: 1 }).catch((e) => e);
    expect((error as ContentClientError).failure.code).toBe("NOT_FOUND");
  });

  it("delete soft-deletes (find then returns null), restore brings it back", async () => {
    const created = await client.posts.create({ title: "D", slug: "d", rank: 1 });
    await client.posts.delete(created.id);
    expect(await client.posts.find(created.id)).toBeNull();

    const restored = await client.posts.restore(created.id);
    expect(restored).toMatchObject({ id: created.id, title: "D", deletedAt: null });
    expect(await client.posts.find(created.id)).not.toBeNull();
  });
});

// ---------- compile-time type checks (never executed; checked by tsc) ----------

// Underscore-prefixed so the lint treats them as intentionally unused; they exist
// only to make `tsc` enforce the inferred client surface.
function _typeChecks(c: ContentClient<typeof config>): void {
  // @ts-expect-error — `title` is a required field.
  void c.posts.create({ slug: "x", rank: 1 });
  // @ts-expect-error — `nope` is not a field on posts.
  void c.posts.create({ title: "a", slug: "b", rank: 1, nope: true });
  // @ts-expect-error — `orderBy` must be a known field or system column.
  void c.posts.list({ orderBy: "bogus" });
  // @ts-expect-error — `findBy` only accepts a real field name.
  void c.posts.findBy("bogus", 1);
}

async function _returnTypes(c: ContentClient<typeof config>): Promise<void> {
  const post = await c.posts.create({ title: "a", slug: "b", rank: 1 });
  const _title: string = post.title;
  const _id: string = post.id;
  const _deletedAt: number | null = post.deletedAt;
  const found: Stored<{ title: string; slug: string; rank: number }> | null =
    await c.posts.find("x");
  void [_title, _id, _deletedAt, found];
}

void [_typeChecks, _returnTypes];
