// The full-text search route over a real (in-memory) SQLite `Database`, driven
// through `createRestHandler` so routing, query parsing, redaction, locale
// flattening, and error mapping are exercised end to end.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";

const articles = defineCollection({
  slug: "articles",
  search: true,
  fields: {
    title: fields.string({ required: true }),
    name: fields.string({ localized: true }),
    internal: fields.string({ access: { read: () => false } }),
  },
});

const notes = defineCollection({
  slug: "notes",
  fields: { title: fields.string({ required: true }) },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en", "fr"], defaultLocale: "en" },
  collections: { articles, notes },
});

function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    if (table.fts) {
      const unindexed = new Set(table.fts.unindexed);
      const cols = table.columns.map((c) =>
        unindexed.has(c.name) ? `${c.name} UNINDEXED` : c.name,
      );
      stmts.push(`CREATE VIRTUAL TABLE "${table.name}" USING fts5(${cols.join(", ")})`);
      continue;
    }
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

let driver: SqliteDriver;
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const db = makeDatabase(config, driver);
  await db.create("articles", {
    title: "Hello kangaroo",
    name: { en: "english", fr: "français" },
    internal: "top secret",
  });
  const ctx: RestContext = { config, database: db };
  handle = createRestHandler(ctx, { basePath: "/admin/api" });
});

async function get(path: string): Promise<Response> {
  const response = await handle(new Request(`https://x${path}`));
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

describe("GET /:collection/search", () => {
  it("returns ranked matches as { data }, redacting read-denied fields", async () => {
    const response = await get("/admin/api/articles/search?q=kangaroo");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: ReadonlyArray<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.title).toBe("Hello kangaroo");
    // The `internal` field's `access.read` denies it on every serialization.
    expect(body.data[0]).not.toHaveProperty("internal");
  });

  it("flattens localized fields for ?locale=", async () => {
    const response = await get("/admin/api/articles/search?q=kangaroo&locale=fr");
    const body = (await response.json()) as { data: ReadonlyArray<Record<string, unknown>> };
    expect(body.data[0]?.name).toBe("français");
  });

  it("is not shadowed by the :id route (literal segment wins)", async () => {
    // `/articles/search` resolves to search, not find-by-id with id=search.
    const response = await get("/admin/api/articles/search?q=nothingmatches");
    const body = (await response.json()) as { data: ReadonlyArray<unknown> };
    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("404s an unknown collection", async () => {
    const response = await get("/admin/api/ghosts/search?q=x");
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: ApiFailure };
    expect(body.error.code).toBe("UNKNOWN_COLLECTION");
  });

  it("400s a collection that isn't search-enabled", async () => {
    const response = await get("/admin/api/notes/search?q=x");
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: ApiFailure };
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
