// The typed client's `locale` reads against the real dispatcher: a `{ locale }`
// argument flattens localized fields (and types the rows via
// `InferLocalizedDoc`); without it the full per-locale records come back.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeBunSqliteDriver } from "../server/database/bun-sqlite-driver";
import { makeDatabase } from "../server/database/database";
import { createRestHandler, type RestContext } from "../server/rest";
import { deriveSchema } from "../sql";
import { type ContentClient, makeClient } from "./index";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ localized: true }),
    slug: fields.slug({ unique: true }),
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
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

describe("locale reads", () => {
  it("flattens localized fields on list({ locale })", async () => {
    await client.posts.create({ title: { "en-US": "Hello", "fr-FR": "Bonjour" }, slug: "hello" });

    const fr = await client.posts.list({ locale: "fr-FR" });
    // Typed: with `locale`, `title` is `string | undefined`, not a record.
    const frTitle: string | undefined = fr.data[0]?.title;
    expect(frTitle).toBe("Bonjour");

    const full = await client.posts.list();
    // Typed: without `locale`, `title` is the per-locale record.
    const enTitle: string | undefined = full.data[0]?.title["en-US"];
    expect(enTitle).toBe("Hello");
  });

  it("flattens on find and findBy with { locale }", async () => {
    const created = await client.posts.create({
      title: { "en-US": "Hello", "fr-FR": "Bonjour" },
      slug: "hello",
    });

    const byId = await client.posts.find(created.id, { locale: "en-US" });
    expect(byId?.title).toBe("Hello");
    const bySlug = await client.posts.findBy("slug", "hello", { locale: "fr-FR" });
    expect(bySlug?.title).toBe("Bonjour");

    const fullRecord = await client.posts.find(created.id);
    expect(fullRecord?.title).toEqual({ "en-US": "Hello", "fr-FR": "Bonjour" });
  });
});
