// Draft/publish workflow through the whole stack: the typed client → REST
// dispatcher → Database over in-memory SQLite. Exercises the `status` list
// param and the publish/unpublish client methods end to end on a draft-enabled
// collection.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeDatabase } from "../server/database/database";
import { makeSqliteDriver } from "../server/database/sqlite-driver";
import { createRestHandler, type RestContext } from "../server/rest";
import { deriveSchema } from "../sql";
import { type ContentClient, makeClient } from "./index";

const posts = defineCollection({
  slug: "posts",
  drafts: true,
  fields: { title: fields.string({ required: true }) },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
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
  const driver = makeSqliteDriver({ url: ":memory:" });
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

describe("drafts over the client", () => {
  it("created rows are drafts, hidden from the default list", async () => {
    const created = await client.posts.create({ title: "Hello" });
    expect(created.status).toBe("draft");
    expect((await client.posts.list()).data).toHaveLength(0);
  });

  it("status=draft / status=any widen the listing", async () => {
    await client.posts.create({ title: "A" });
    expect((await client.posts.list({ status: "draft" })).data).toHaveLength(1);
    expect((await client.posts.list({ status: "any" })).data).toHaveLength(1);
    expect((await client.posts.list({ status: "published" })).data).toHaveLength(0);
  });

  it("publish makes a row live and visible by default", async () => {
    const created = await client.posts.create({ title: "Hello" });
    const published = await client.posts.publish(created.id);
    expect(published.status).toBe("published");
    expect((await client.posts.list()).data.map((d) => d.id)).toEqual([created.id]);
  });

  it("a future publish schedule is not live yet", async () => {
    const created = await client.posts.create({ title: "Soon" });
    await client.posts.publish(created.id, { at: Date.now() + 60_000 });
    expect((await client.posts.list()).data).toHaveLength(0);
    expect((await client.posts.list({ status: "any" })).data).toHaveLength(1);
  });

  it("unpublish returns a row to draft", async () => {
    const created = await client.posts.create({ title: "Hello" });
    await client.posts.publish(created.id);
    const back = await client.posts.unpublish(created.id);
    expect(back.status).toBe("draft");
    expect((await client.posts.list()).data).toHaveLength(0);
  });

  it("publishing a missing row is a typed NOT_FOUND error", async () => {
    expect(client.posts.publish("nope")).rejects.toMatchObject({ failure: { code: "NOT_FOUND" } });
  });
});
