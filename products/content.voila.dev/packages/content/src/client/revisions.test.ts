// Version history through the whole stack: the typed client → REST dispatcher
// → Database over in-memory SQLite. Exercises the `revisions`/`revision`/
// `restoreRevision` client methods end to end on a revisions-enabled collection.

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
  revisions: true,
  fields: { title: fields.string({ required: true }) },
});

const pages = defineCollection({
  slug: "pages",
  fields: { title: fields.string({ required: true }) },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts, pages } });

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

describe("revisions over the client", () => {
  it("every content write appends a revision, listed newest first", async () => {
    const created = await client.posts.create({ title: "v1" });
    await client.posts.update(created.id, { title: "v2" });
    await client.posts.publish(created.id);

    const page = await client.posts.revisions(created.id);
    expect(page.data.map((r) => r.rev)).toEqual([3, 2, 1]);
    expect(page.data.map((r) => r.doc.title)).toEqual(["v2", "v2", "v1"]);
    // Snapshots carry the typed stored row — draft columns included here.
    expect(page.data[0]?.doc.status).toBe("published");
    expect(page.nextCursor).toBeNull();
  });

  it("pages history with limit + cursor", async () => {
    const created = await client.posts.create({ title: "v1" });
    await client.posts.update(created.id, { title: "v2" });
    await client.posts.update(created.id, { title: "v3" });

    const first = await client.posts.revisions(created.id, { limit: 2 });
    expect(first.data.map((r) => r.rev)).toEqual([3, 2]);
    const second = await client.posts.revisions(created.id, {
      limit: 2,
      cursor: first.nextCursor as string,
    });
    expect(second.data.map((r) => r.rev)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
  });

  it("fetches one revision; a missing rev is null", async () => {
    const created = await client.posts.create({ title: "v1" });
    await client.posts.update(created.id, { title: "v2" });
    const rev = await client.posts.revision(created.id, 1);
    expect(rev?.doc.title).toBe("v1");
    expect(await client.posts.revision(created.id, 99)).toBeNull();
  });

  it("restores a past revision and returns the stored row", async () => {
    const created = await client.posts.create({ title: "v1" });
    await client.posts.update(created.id, { title: "v2" });
    const restored = await client.posts.restoreRevision(created.id, 1);
    expect(restored.title).toBe("v1");
    expect((await client.posts.revisions(created.id)).data.map((r) => r.rev)).toEqual([3, 2, 1]);
  });

  it("revision methods on a collection without revisions are a typed BAD_REQUEST", async () => {
    const page = await client.pages.create({ title: "About" });
    expect(client.pages.revisions(page.id)).rejects.toMatchObject({
      failure: { code: "BAD_REQUEST" },
    });
    expect(client.pages.restoreRevision(page.id, 1)).rejects.toMatchObject({
      failure: { code: "BAD_REQUEST" },
    });
  });
});
