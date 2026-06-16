// Singleton REST routes through the `createRestHandler` dispatcher over a real
// (in-memory) SQLite `Database`, with the DDL `CHECK ("id" = '<slug>')` in
// place: `GET /:singleton` returns the one document as an object envelope (404
// until the first write), `PUT`/`POST /:singleton` upsert it, and the write
// classifies as a mutating `update` for the CSRF guard.

import { beforeEach, describe, expect, it } from "bun:test";
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
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }) },
});

const settings = defineSingleton({
  slug: "settings",
  fields: {
    siteName: fields.string({ required: true }),
    tagline: fields.string(),
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  collections: { posts },
  singletons: { settings },
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
    if (table.singletonCheck) cols.push(`CHECK ("id" = '${table.singletonCheck.id}')`);
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
  }
  return stmts;
}

let driver: SqliteDriver;
let ctx: RestContext;
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  ctx = { config, database: makeDatabase(config, driver) };
  handle = createRestHandler(ctx, { basePath: "/admin/api" });
});

interface SendInit {
  readonly method: string;
  readonly body?: unknown;
}

// Returns null (not a thrown error) for unmatched routes so the fall-through
// behavior is assertable.
async function sendRaw(path: string, init: SendInit): Promise<Response | null> {
  const request =
    init.body === undefined
      ? new Request(`https://x${path}`, { method: init.method })
      : new Request(`https://x${path}`, {
          method: init.method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(init.body),
        });
  return handle(request);
}

async function send(path: string, init: SendInit): Promise<Response> {
  const response = await sendRaw(path, init);
  if (response === null) throw new Error(`route not matched: ${init.method} ${path}`);
  return response;
}

async function failureOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

describe("singleton REST routes", () => {
  it("GET is NOT_FOUND until the first write", async () => {
    const response = await send("/admin/api/settings", { method: "GET" });
    expect(response.status).toBe(404);
    expect((await failureOf(response)).code).toBe("NOT_FOUND");
  });

  it("PUT creates the document and echoes the stored row", async () => {
    const response = await send("/admin/api/settings", {
      method: "PUT",
      body: { data: { siteName: "Acme", tagline: "hello" } },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data.id).toBe("settings");
    expect(body.data.siteName).toBe("Acme");
  });

  it("GET returns an object envelope, not a list", async () => {
    await send("/admin/api/settings", { method: "PUT", body: { data: { siteName: "Acme" } } });
    const response = await send("/admin/api/settings", { method: "GET" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Array.isArray(body.data)).toBe(false);
    expect((body.data as Record<string, unknown>).siteName).toBe("Acme");
    expect("nextCursor" in body).toBe(false);
  });

  it("a second PUT replaces in place — same id, no second row", async () => {
    await send("/admin/api/settings", {
      method: "PUT",
      body: { data: { siteName: "Acme", tagline: "hello" } },
    });
    const response = await send("/admin/api/settings", {
      method: "PUT",
      body: { data: { siteName: "Acme 2" } },
    });
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data.id).toBe("settings");
    expect(body.data.siteName).toBe("Acme 2");
    const rows = await driver.all(`SELECT COUNT(*) AS n FROM "settings"`, []);
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it("POST is an upsert alias", async () => {
    const created = await send("/admin/api/settings", {
      method: "POST",
      body: { data: { siteName: "Acme" } },
    });
    expect(created.status).toBe(200);
    const updated = await send("/admin/api/settings", {
      method: "POST",
      body: { data: { siteName: "Acme 2" } },
    });
    const body = (await updated.json()) as { data: Record<string, unknown> };
    expect(body.data.siteName).toBe("Acme 2");
  });

  it("PUT after DELETE revives the one document", async () => {
    await send("/admin/api/settings", { method: "PUT", body: { data: { siteName: "Acme" } } });
    await send("/admin/api/settings/settings", { method: "DELETE" });
    expect((await send("/admin/api/settings", { method: "GET" })).status).toBe(404);
    const revived = await send("/admin/api/settings", {
      method: "PUT",
      body: { data: { siteName: "Back" } },
    });
    expect(revived.status).toBe(200);
    expect((await send("/admin/api/settings", { method: "GET" })).status).toBe(200);
  });

  it("PUT validates the full payload (missing required → 422)", async () => {
    const response = await send("/admin/api/settings", {
      method: "PUT",
      body: { data: { tagline: "no name" } },
    });
    expect(response.status).toBe(422);
    const failure = await failureOf(response);
    expect(failure.code).toBe("VALIDATION");
  });

  it("PUT classifies as mutating for the CSRF guard", async () => {
    const guarded = createRestHandler(ctx, {
      basePath: "/admin/api",
      csrf: { secret: "test-secret" },
    });
    const response = await guarded(
      new Request("https://x/admin/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { siteName: "Acme" } }),
      }),
    );
    expect(response?.status).toBe(403);
    expect((await failureOf(response as Response)).code).toBe("CSRF");
  });

  it("PUT on a regular collection stays unrouted", async () => {
    expect(await sendRaw("/admin/api/posts", { method: "PUT", body: { data: {} } })).toBeNull();
  });

  it("collection list routes are unaffected", async () => {
    const response = await send("/admin/api/posts", { method: "GET" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown };
    expect(Array.isArray(body.data)).toBe(true);
  });
});
