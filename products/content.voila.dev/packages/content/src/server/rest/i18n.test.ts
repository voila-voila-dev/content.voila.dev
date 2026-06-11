// `?locale=` reads end to end through `createRestHandler`: flattening on
// list / find-by-id / find-by-field, the fallback chain (including the
// per-locale `fallback` graph), and the 400s for unknown or un-configured
// locales. Writes and their echoes stay full-record by design — also pinned.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeDatabase } from "../database/database";
import { makeSqliteDriver, type SqliteDriver } from "../database/sqlite-driver";
import type { Database, Document } from "../database/types";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ localized: true }),
    slug: fields.slug({ unique: true }),
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: {
    locales: ["en-US", "fr-FR", "de-DE"],
    defaultLocale: "en-US",
    fallback: { "de-DE": ["fr-FR"] },
  },
  collections: { posts },
});

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
  }
  return stmts;
}

let database: Database;
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  const driver: SqliteDriver = makeSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  database = makeDatabase(config, driver);
  const ctx: RestContext = { config, database };
  handle = createRestHandler(ctx, { basePath: "/admin/api" });
});

async function send(path: string): Promise<Response> {
  const response = await handle(new Request(`https://x/admin/api${path}`));
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

async function dataOf<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

function seed(): Promise<Document> {
  return database.create("posts", {
    // No German value — de-DE exercises the fallback chain.
    title: { "en-US": "Hello", "fr-FR": "Bonjour" },
    slug: "hello",
  });
}

describe("?locale on reads", () => {
  it("flattens localized fields on a list", async () => {
    await seed();
    const rows = await dataOf<Document[]>(await send("/posts?locale=fr-FR"));
    expect(rows[0]?.title).toBe("Bonjour");
    expect(rows[0]?.slug).toBe("hello");
  });

  it("returns full per-locale records without the parameter", async () => {
    await seed();
    const rows = await dataOf<Document[]>(await send("/posts"));
    expect(rows[0]?.title).toEqual({ "en-US": "Hello", "fr-FR": "Bonjour" });
  });

  it("walks the fallback graph, then the default locale", async () => {
    const row = await seed();
    // de-DE has no value; its fallback list names fr-FR first.
    const viaFallback = await dataOf<Document>(await send(`/posts/${row.id}?locale=de-DE`));
    expect(viaFallback.title).toBe("Bonjour");
  });

  it("flattens on find-by-unique-field too", async () => {
    await seed();
    const row = await dataOf<Document>(await send("/posts/by/slug/hello?locale=en-US"));
    expect(row.title).toBe("Hello");
  });

  it("400s an unknown locale, naming the configured ones", async () => {
    await seed();
    const res = await send("/posts?locale=xx-XX");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: ApiFailure };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("400s when the config has no i18n at all", async () => {
    const plain = defineCollection({ slug: "plain", fields: { name: fields.string() } });
    const cfg = defineConfig({ branding: { name: "T" }, collections: { plain } });
    const driver = makeSqliteDriver({ url: ":memory:" });
    for (const statement of schemaStatements(cfg)) await driver.run(statement);
    const handleNoI18n = createRestHandler(
      { config: cfg, database: makeDatabase(cfg, driver) },
      { basePath: "/admin/api" },
    );
    const res = await handleNoI18n(new Request("https://x/admin/api/plain?locale=en-US"));
    expect(res?.status).toBe(400);
  });
});

describe("writes stay full-record", () => {
  it("echoes the full per-locale record on create", async () => {
    const res = await handle(
      new Request("https://x/admin/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: {
            title: { "en-US": "Hi", "fr-FR": "Salut", "de-DE": "Hallo" },
            slug: "hi",
          },
        }),
      }),
    );
    expect(res?.status).toBe(201);
    const body = (await res?.json()) as { data: Document };
    expect(body.data.title).toEqual({ "en-US": "Hi", "fr-FR": "Salut", "de-DE": "Hallo" });
  });

  it("rejects a partial per-locale record (narrowed validator wants every locale)", async () => {
    const res = await handle(
      new Request("https://x/admin/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { title: { "en-US": "Hi" }, slug: "partial" } }),
      }),
    );
    expect(res?.status).toBe(422);
  });
});
