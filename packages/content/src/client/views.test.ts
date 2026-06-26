// The typed client's `.<collection>.views` sub-API end to end against the real
// `_views` routes — the same fetch-into-dispatcher bridge the other client tests
// use, with an authenticator pinning a fixed principal (views are shared, so the
// principal is just the recorded creator). Listing seeds the default Table view.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeBunSqliteDriver } from "../server/database/bun-sqlite-driver";
import { makeDatabase } from "../server/database/database";
import { createRestHandler, type RestContext } from "../server/rest";
import { makeViewStore } from "../server/views/store";
import { deriveSchema } from "../sql";
import { type ContentClient, makeClient } from "./index";

const posts = defineCollection({
  slug: "posts",
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
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = {
    config,
    database: makeDatabase(config, driver),
    views: { store: makeViewStore(driver) },
  };
  const handle = createRestHandler(ctx, {
    basePath: "/admin/api",
    auth: { authenticate: async () => ({ id: "u1" }) },
  });
  // Typed as the relaxed `Fetch` the client accepts (not `typeof fetch`), so the
  // bridge needn't implement the static `fetch.preconnect`.
  const fetchImpl = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await handle(new Request(input as string, init));
    return (
      response ?? new Response(JSON.stringify({ error: { code: "INTERNAL" } }), { status: 500 })
    );
  };
  client = makeClient(config, { baseUrl: "https://x/admin/api", fetch: fetchImpl });
});

describe("client.<collection>.views", () => {
  it("creates, lists, updates and deletes a view, round-tripping the config", async () => {
    const created = await client.posts.views.create({
      name: "Recent",
      type: "table",
      config: { columns: ["title"], sort: { field: "createdAt", direction: "desc" } },
    });
    expect(created.name).toBe("Recent");
    expect(created.config.columns).toEqual(["title"]);

    // The list seeds the undeletable default Table view alongside the new one.
    const listed = await client.posts.views.list();
    expect(listed.map((v) => v.name).sort()).toEqual(["Recent", "Table"]);
    expect(listed.some((v) => v.id === created.id)).toBe(true);
    expect(listed.find((v) => v.seeded)?.name).toBe("Table");

    const updated = await client.posts.views.update(created.id, {
      name: "Latest",
      isDefault: true,
    });
    expect(updated.name).toBe("Latest");
    expect(updated.isDefault).toBe(true);

    await client.posts.views.delete(created.id);
    // Only the seeded default survives a delete of the created view.
    expect((await client.posts.views.list()).map((v) => v.name)).toEqual(["Table"]);
  });
});
