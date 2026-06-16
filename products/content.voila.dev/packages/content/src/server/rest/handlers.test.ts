// REST read layer over a real (in-memory) SQLite `Database`, driven through the
// `createRestHandler` dispatcher so the routing, query parsing, envelope shaping,
// and error mapping are all exercised end to end. Schema is rendered straight
// from `deriveSchema` (same approach as the Database tests) so the suite stays
// inside `@voila/content`.

import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  defineCollection,
  defineConfig,
  defineSingleton,
  fields,
  type NormalizedConfig,
} from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import type { ApiFailure } from "./errors";
import { handleList, type RestContext } from "./handlers";
import { createRestHandler } from "./router";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.slug(),
    rank: fields.number(),
    meta: fields.json(),
    // Localized fields store a per-locale JSON record — never orderable.
    subtitle: fields.string({ localized: true }),
  },
});

const settings = defineSingleton({
  slug: "settings",
  fields: { siteName: fields.string({ required: true }) },
});

// `widgets` is declared in the config but its table is never created, so any
// read against it makes the driver throw — the `INTERNAL` mapping path.
const widgets = defineCollection({
  slug: "widgets",
  fields: { name: fields.string({ required: true }) },
});

const config = defineConfig({
  branding: { name: "Test" },
  collections: { posts, widgets },
  singletons: { settings },
});

function schemaStatements(cfg: NormalizedConfig, only: ReadonlySet<string>): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    if (!only.has(table.name)) continue;
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
  readonly slug: string;
  readonly rank: number | null;
  readonly meta: unknown;
  readonly createdAt: number;
  readonly deletedAt?: number;
}

const seedRows: ReadonlyArray<SeedRow> = [
  { id: "p1", title: "First", slug: "first", rank: null, meta: { tag: "a" }, createdAt: 1000 },
  { id: "p2", title: "Second", slug: "second", rank: 5, meta: { tag: "b" }, createdAt: 2000 },
  { id: "p3", title: "Third", slug: "third", rank: null, meta: { tag: "c" }, createdAt: 3000 },
  { id: "p4", title: "Fourth", slug: "fourth", rank: 10, meta: { tag: "d" }, createdAt: 4000 },
  // Soft-deleted: must never surface in reads.
  {
    id: "p5",
    title: "Gone",
    slug: "gone",
    rank: 99,
    meta: null,
    createdAt: 5000,
    deletedAt: 5_500,
  },
];

let driver: SqliteDriver;
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  // Create posts + settings, but deliberately not widgets.
  for (const statement of schemaStatements(config, new Set(["posts", "settings"]))) {
    await driver.run(statement);
  }
  for (const row of seedRows) {
    await driver.run(
      "INSERT INTO posts (id, title, slug, rank, meta, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        row.id,
        row.title,
        row.slug,
        row.rank,
        JSON.stringify(row.meta),
        row.createdAt,
        row.deletedAt ?? null,
      ],
    );
  }
  await driver.run("INSERT INTO settings (id, site_name, created_at) VALUES (?, ?, ?)", [
    "settings",
    "Voila",
    1000,
  ]);

  const ctx: RestContext = { config, database: makeDatabase(config, driver) };
  // A no-op hook keeps the INTERNAL-path tests from logging through the default;
  // the hook's own behavior is covered by the `onError` suite below.
  handle = createRestHandler(ctx, { basePath: "/admin/api", onError: () => {} });
});

// Issue a GET and assert the dispatcher owned the route (non-null).
async function get(path: string): Promise<Response> {
  const response = await handle(new Request(`https://x${path}`));
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

async function failureOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

describe("list — GET /:collection", () => {
  it("returns live rows newest-first as { data, nextCursor }", async () => {
    const response = await get("/admin/api/posts");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }>; nextCursor: null };
    expect(body.data.map((d) => d.id)).toEqual(["p4", "p3", "p2", "p1"]);
    expect(body.nextCursor).toBeNull();
    // JSON columns are parsed; soft-deleted p5 is absent.
    expect(body.data[0]).toMatchObject({ title: "Fourth", meta: { tag: "d" } });
  });

  it("paginates via the opaque cursor without overlap", async () => {
    const first = (await (await get("/admin/api/posts?limit=2")).json()) as {
      data: Array<{ id: string }>;
      nextCursor: string;
    };
    expect(first.data.map((d) => d.id)).toEqual(["p4", "p3"]);
    expect(first.nextCursor).not.toBeNull();

    const second = (await (
      await get(`/admin/api/posts?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json()) as { data: Array<{ id: string }>; nextCursor: null };
    expect(second.data.map((d) => d.id)).toEqual(["p2", "p1"]);
    expect(second.nextCursor).toBeNull();
  });

  it("honors orderBy + order=asc", async () => {
    const body = (await (await get("/admin/api/posts?orderBy=title&order=asc")).json()) as {
      data: Array<{ title: string }>;
    };
    expect(body.data.map((d) => d.title)).toEqual(["First", "Fourth", "Second", "Third"]);
  });

  it("returns the scope's total with ?count=1, spanning every page", async () => {
    const first = (await (await get("/admin/api/posts?limit=2&count=1")).json()) as {
      data: Array<{ id: string }>;
      nextCursor: string;
      total: number;
    };
    expect(first.data).toHaveLength(2);
    // The total covers all pages and still excludes the soft-deleted row.
    expect(first.total).toBe(4);

    const second = (await (
      await get(`/admin/api/posts?limit=2&count=1&cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json()) as { total: number };
    expect(second.total).toBe(4);
  });

  it("omits total without ?count (and with ?count=0)", async () => {
    expect("total" in ((await (await get("/admin/api/posts")).json()) as object)).toBe(false);
    expect("total" in ((await (await get("/admin/api/posts?count=0")).json()) as object)).toBe(
      false,
    );
  });

  it("rejects a bad count value with 400 BAD_REQUEST", async () => {
    const response = await get("/admin/api/posts?count=maybe");
    expect(response.status).toBe(400);
    expect(await failureOf(response)).toMatchObject({
      code: "BAD_REQUEST",
      details: { field: "count" },
    });
  });

  it("serves a singleton as an object envelope, not a list", async () => {
    const body = (await (await get("/admin/api/settings")).json()) as {
      data: { siteName: string };
    };
    expect(Array.isArray(body.data)).toBe(false);
    expect(body.data).toMatchObject({ id: "settings", siteName: "Voila" });
  });

  it("rejects an unknown collection with 404 UNKNOWN_COLLECTION", async () => {
    const response = await get("/admin/api/nope");
    expect(response.status).toBe(404);
    expect(await failureOf(response)).toEqual({ code: "UNKNOWN_COLLECTION", slug: "nope" });
  });

  it("rejects a non-scalar orderBy with 400 INVALID_ORDER", async () => {
    const response = await get("/admin/api/posts?orderBy=meta");
    expect(response.status).toBe(400);
    expect(await failureOf(response)).toMatchObject({ code: "INVALID_ORDER", orderKey: "meta" });
  });

  it("rejects ordering by a localized field with 400 INVALID_ORDER", async () => {
    expect(await failureOf(await get("/admin/api/posts?orderBy=subtitle"))).toMatchObject({
      code: "INVALID_ORDER",
      orderKey: "subtitle",
    });
  });

  it("rejects a bad limit with 400 BAD_REQUEST", async () => {
    const response = await get("/admin/api/posts?limit=0");
    expect(response.status).toBe(400);
    expect(await failureOf(response)).toMatchObject({
      code: "BAD_REQUEST",
      details: { field: "limit" },
    });
  });

  it("rejects a bad order direction with 400 BAD_REQUEST", async () => {
    expect(await failureOf(await get("/admin/api/posts?order=sideways"))).toMatchObject({
      code: "BAD_REQUEST",
      details: { field: "order" },
    });
  });

  it("rejects a malformed cursor with 400 INVALID_CURSOR", async () => {
    const response = await get("/admin/api/posts?cursor=not-a-real-cursor");
    expect(response.status).toBe(400);
    expect(await failureOf(response)).toEqual({ code: "INVALID_CURSOR" });
  });

  it("rejects a cursor replayed under a different ordering with 400 INVALID_CURSOR", async () => {
    // Mint a cursor under the default ordering (createdAt desc)…
    const first = (await (await get("/admin/api/posts?limit=2")).json()) as { nextCursor: string };
    // …then replay it under orderBy=title.
    const replayed = await get(
      `/admin/api/posts?limit=2&orderBy=title&cursor=${encodeURIComponent(first.nextCursor)}`,
    );
    expect(await failureOf(replayed)).toEqual({ code: "INVALID_CURSOR" });
  });

  it("maps a driver failure to 500 INTERNAL without leaking internals", async () => {
    // `widgets` has no table — the SELECT throws inside the Database.
    const response = await get("/admin/api/widgets");
    expect(response.status).toBe(500);
    expect(await failureOf(response)).toEqual({ code: "INTERNAL" });
  });
});

describe("find by id — GET /:collection/:id", () => {
  it("returns the row as { data }", async () => {
    const response = await get("/admin/api/posts/p2");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { id: string; title: string } };
    expect(body.data).toMatchObject({ id: "p2", title: "Second", slug: "second" });
  });

  it("returns 404 NOT_FOUND for a missing id", async () => {
    const response = await get("/admin/api/posts/absent");
    expect(response.status).toBe(404);
    expect(await failureOf(response)).toEqual({ code: "NOT_FOUND", collectionSlug: "posts" });
  });

  it("returns 404 NOT_FOUND for a soft-deleted id", async () => {
    expect((await get("/admin/api/posts/p5")).status).toBe(404);
  });
});

describe("find by field — GET /:collection/by/:field/:value", () => {
  it("returns the row matching a unique field", async () => {
    const body = (await (await get("/admin/api/posts/by/slug/second")).json()) as {
      data: { id: string };
    };
    expect(body.data).toMatchObject({ id: "p2", slug: "second" });
  });

  it("returns 404 NOT_FOUND when nothing matches", async () => {
    expect((await get("/admin/api/posts/by/slug/nope")).status).toBe(404);
  });

  it("excludes soft-deleted rows", async () => {
    expect((await get("/admin/api/posts/by/slug/gone")).status).toBe(404);
  });

  it("rejects an unknown field with 404 UNKNOWN_FIELD", async () => {
    const response = await get("/admin/api/posts/by/nope/x");
    expect(response.status).toBe(404);
    expect(await failureOf(response)).toMatchObject({ code: "UNKNOWN_FIELD", field: "nope" });
  });

  it("rejects a non-unique field with 400 FIELD_NOT_UNIQUE", async () => {
    const response = await get("/admin/api/posts/by/title/Second");
    expect(response.status).toBe(400);
    expect(await failureOf(response)).toMatchObject({
      code: "FIELD_NOT_UNIQUE",
      field: "title",
    });
  });
});

describe("router", () => {
  it("returns null for an unsupported method", async () => {
    expect(await handle(new Request("https://x/admin/api/posts", { method: "PUT" }))).toBeNull();
  });

  it("returns null for a path outside the base", async () => {
    expect(await handle(new Request("https://x/other/posts"))).toBeNull();
  });

  it("returns null for an unmatched route shape", async () => {
    // Three segments that aren't a `/by/` lookup.
    expect(await handle(new Request("https://x/admin/api/posts/p1/extra"))).toBeNull();
    // Zero segments under the base.
    expect(await handle(new Request("https://x/admin/api"))).toBeNull();
  });

  it("mounts at the root when no basePath is given", async () => {
    const ctx: RestContext = { config, database: makeDatabase(config, driver) };
    const rootHandle = createRestHandler(ctx);
    const response = await rootHandle(new Request("https://x/posts/p1"));
    expect(response?.status).toBe(200);
  });

  it("decodes percent-encoded path segments", async () => {
    // The slug is plain, but the value arrives URL-encoded; it must decode to match.
    expect((await get("/admin/api/posts/by/slug/sec%6fnd")).status).toBe(200);
  });
});

describe("onError", () => {
  // `widgets` has no table, so any read throws inside the driver — the only
  // path that folds to INTERNAL and should reach the hook.
  const WIDGETS = "https://x/admin/api/widgets";

  it("receives the cause when an unexpected throw folds to INTERNAL", async () => {
    const seen: unknown[] = [];
    const ctx: RestContext = { config, database: makeDatabase(config, driver) };
    const handler = createRestHandler(ctx, {
      basePath: "/admin/api",
      onError: (error) => seen.push(error),
    });
    const response = await handler(new Request(WIDGETS));
    expect(response?.status).toBe(500);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Error);
  });

  it("never fires for typed ApiFailures — they're expected control flow", async () => {
    const seen: unknown[] = [];
    const ctx: RestContext = { config, database: makeDatabase(config, driver) };
    const handler = createRestHandler(ctx, {
      basePath: "/admin/api",
      onError: (error) => seen.push(error),
    });
    expect((await handler(new Request("https://x/admin/api/nope")))?.status).toBe(404);
    expect((await handler(new Request("https://x/admin/api/posts?limit=0")))?.status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it("prefers a hook set on the context over the mount option", async () => {
    const calls: string[] = [];
    const ctx: RestContext = {
      config,
      database: makeDatabase(config, driver),
      onError: () => calls.push("ctx"),
    };
    const handler = createRestHandler(ctx, {
      basePath: "/admin/api",
      onError: () => calls.push("option"),
    });
    await handler(new Request(WIDGETS));
    expect(calls).toEqual(["ctx"]);
  });

  it("defaults to console.error outside production", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    try {
      const ctx: RestContext = { config, database: makeDatabase(config, driver) };
      const response = await handleList(ctx, "widgets", new URL(WIDGETS));
      expect(response.status).toBe(500);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("stays silent by default in production", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const ctx: RestContext = { config, database: makeDatabase(config, driver) };
      await handleList(ctx, "widgets", new URL(WIDGETS));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = nodeEnv;
      spy.mockRestore();
    }
  });
});
