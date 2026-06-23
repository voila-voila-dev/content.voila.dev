// Full-text search through the whole stack: the typed client → REST dispatcher
// → Database over in-memory SQLite (FTS5). Exercises the `search` client method
// end to end on a search-enabled collection, including the locale overload.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeBunSqliteDriver } from "../server/database/bun-sqlite-driver";
import { makeDatabase } from "../server/database/database";
import { createRestHandler, type RestContext } from "../server/rest";
import { deriveSchema } from "../sql";
import { type ContentClient, makeClient } from "./index";

const posts = defineCollection({
  slug: "posts",
  search: true,
  fields: {
    title: fields.string({ required: true }),
    name: fields.string({ localized: true }),
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en", "fr"], defaultLocale: "en" },
  collections: { posts },
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
  }
  return stmts;
}

let client: ContentClient<typeof config>;

beforeEach(async () => {
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = { config, database: makeDatabase(config, driver) };
  const handle = createRestHandler(ctx, { basePath: "/admin/api" });
  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await handle(new Request(input as string, init));
    return (
      response ?? new Response(JSON.stringify({ error: { code: "INTERNAL" } }), { status: 500 })
    );
  };
  client = makeClient(config, { baseUrl: "https://x/admin/api", fetch: fetchImpl });
});

describe("search over the client", () => {
  it("returns matching rows typed from the config", async () => {
    await client.posts.create({ title: "Brown fox", name: { en: "fox", fr: "renard" } });
    await client.posts.create({ title: "Sleepy dog", name: { en: "dog", fr: "chien" } });
    const page = await client.posts.search("fox");
    expect(page.data.map((d) => d.title)).toEqual(["Brown fox"]);
  });

  it("flattens localized fields under the locale overload", async () => {
    await client.posts.create({ title: "Untitled", name: { en: "kangaroo", fr: "kangourou" } });
    const page = await client.posts.search("Untitled", { locale: "fr" });
    expect(page.data[0]?.name).toBe("kangourou");
  });

  it("returns an empty page when nothing matches", async () => {
    await client.posts.create({ title: "Anything", name: { en: "", fr: "" } });
    const page = await client.posts.search("zzz");
    expect(page.data).toEqual([]);
  });
});
