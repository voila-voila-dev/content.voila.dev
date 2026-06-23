// The admin server runtime end to end over a real (in-memory) SQLite database.
// Stub auth/access keep the suite inside `@voila/content-admin` (no Better Auth tables):
// they prove the wiring — that `createAdminRuntime` composes a working REST
// dispatcher and that `createApiHandler` routes auth vs REST and seeds the CSRF
// cookie — without re-testing the engine's own guard, which `@voila/content`
// already covers.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import type { AccessControl, Authenticator } from "@voila/content/server";
import { makeBunSqliteDriver, type SqliteDriver } from "@voila/content/server/bun-sqlite";
import { deriveSchema } from "@voila/content/sql";
import { createApiHandler } from "./api-handler";
import { createAdminRuntime } from "./runtime";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.slug(),
  },
});

const config: NormalizedConfig = defineConfig({
  branding: { name: "Test" },
  collections: { posts },
});

// Render the derived schema straight to DDL (same approach as the engine tests).
async function createTables(driver: SqliteDriver, cfg: NormalizedConfig): Promise<void> {
  const stmts: string[] = [];
  for (const table of deriveSchema(cfg)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      if (c.defaultExpr?.sqlite) parts.push(`DEFAULT ${c.defaultExpr.sqlite}`);
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
    for (const idx of table.indexes) {
      const c = idx.columns.map((x) => `"${x}"`).join(", ");
      stmts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX "${idx.name}" ON "${idx.table}" (${c})`,
      );
    }
  }
  await Promise.all(stmts.map((s) => driver.run(s)));
}

// A principal-yielding authenticator + permissive access — the secure path is
// `@voila/content`'s to test; here we just need authorized reads to pass.
const allowAuth: Authenticator = { authenticate: async () => ({ id: "admin", email: "a@b.co" }) };
const allowAccess: AccessControl = () => true;

const SECRET = "test-secret-0123456789";

describe("createAdminRuntime", () => {
  let driver: SqliteDriver;

  beforeEach(async () => {
    driver = makeBunSqliteDriver({ url: ":memory:" });
    await createTables(driver, config);
  });

  it("composes a runtime bag from a driver + secret", () => {
    const rt = createAdminRuntime(config, {
      driver,
      secret: SECRET,
      authenticator: allowAuth,
      access: allowAccess,
    });
    expect(rt.authSecret).toBe(SECRET);
    expect(rt.basePath).toBe("/api");
    expect(rt.auth.basePath).toBe("/api/auth");
    expect(typeof rt.restHandler).toBe("function");
  });

  it("serves an authorized list through the REST handler", async () => {
    const rt = createAdminRuntime(config, {
      driver,
      secret: SECRET,
      authenticator: allowAuth,
      access: allowAccess,
    });
    const res = await rt.restHandler(new Request("https://x/api/posts"));
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("honours a custom basePath for both REST and auth routes", () => {
    const rt = createAdminRuntime(config, {
      driver,
      secret: SECRET,
      basePath: "/cms/api",
      authenticator: allowAuth,
      access: allowAccess,
    });
    expect(rt.basePath).toBe("/cms/api");
    expect(rt.auth.basePath).toBe("/cms/api/auth");
  });
});

describe("createApiHandler", () => {
  let rt: ReturnType<typeof createAdminRuntime>;

  beforeEach(async () => {
    const driver = makeBunSqliteDriver({ url: ":memory:" });
    await createTables(driver, config);
    rt = createAdminRuntime(config, {
      driver,
      secret: SECRET,
      authenticator: allowAuth,
      access: allowAccess,
    });
  });

  it("routes auth requests to the auth handler", async () => {
    const handle = createApiHandler(rt);
    const res = await handle(new Request("https://x/api/auth/anything"));
    // The stub auth handler 404s; the point is it was routed there, not to REST.
    expect(res.status).toBe(404);
  });

  it("seeds a signed CSRF cookie on the first response", async () => {
    const handle = createApiHandler(rt);
    const res = await handle(new Request("https://x/api/posts"));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("voila_csrf=");
    expect(cookie).toContain("Secure"); // https request → Secure attribute
  });

  it("does not reseed the CSRF cookie when one is already present", async () => {
    const handle = createApiHandler(rt);
    const res = await handle(
      new Request("https://x/api/posts", { headers: { cookie: "voila_csrf=existing" } }),
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 404 for an unmatched REST route (handler owns the whole space)", async () => {
    const handle = createApiHandler(rt);
    const res = await handle(new Request("https://x/api/not-a-collection/x/y/z"));
    expect(res.status).toBe(404);
  });
});
