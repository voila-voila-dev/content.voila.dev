// The auth/CSRF/RBAC guard exercised through the real `createRestHandler`
// dispatcher over an in-memory SQLite `Database` — so route matching, the guard
// pipeline, and the underlying handlers run end to end. The schema is rendered
// from `deriveSchema`, matching the other server suites, keeping everything
// inside `@voila/content`.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeDatabase } from "../database/database";
import { makeSqliteDriver } from "../database/sqlite-driver";
import type { ApiFailure } from "../rest/errors";
import type { RestContext } from "../rest/handlers";
import { createRestHandler, type RestHandlerOptions } from "../rest/router";
import type { AccessControl } from "./access";
import type { Authenticator } from "./authenticator";
import { issueCsrfToken } from "./csrf";
import type { Principal } from "./principal";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.slug(),
  },
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

const SECRET = "guard-test-secret";
const ADMIN: Principal = { id: "u1", email: "a@x.dev", roles: ["admin"] };
const VIEWER: Principal = { id: "u2", email: "v@x.dev", roles: ["viewer"] };

// An authenticator keyed off a bearer header, so a test picks who's calling.
const bearerAuth: Authenticator = {
  async authenticate(request) {
    const who = request.headers.get("authorization");
    if (who === "Bearer admin") return ADMIN;
    if (who === "Bearer viewer") return VIEWER;
    return null;
  },
};

// Admins may do anything; everyone else is read-only.
const roleAccess: AccessControl = ({ principal, operation }) => {
  if (principal.roles?.includes("admin")) return true;
  return operation === "list" || operation === "read";
};

let ctx: RestContext;

beforeEach(async () => {
  const driver = makeSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  await driver.run("INSERT INTO posts (id, title, slug, created_at) VALUES (?, ?, ?, ?)", [
    "p1",
    "Hello",
    "hello",
    1000,
  ]);
  ctx = { config, database: makeDatabase(config, driver) };
});

function handlerWith(options: RestHandlerOptions): (r: Request) => Promise<Response | null> {
  return createRestHandler(ctx, { basePath: "/admin/api", ...options });
}

// Issue a request and assert the dispatcher owned the route (non-null).
async function send(
  handle: (r: Request) => Promise<Response | null>,
  request: Request,
): Promise<Response> {
  const response = await handle(request);
  if (response === null) throw new Error(`route not matched: ${request.method} ${request.url}`);
  return response;
}

function req(method: string, path: string, init: RequestInit = {}): Request {
  return new Request(`https://x${path}`, { method, ...init });
}

async function failureOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

describe("auth seam", () => {
  it("lets every request through when no authenticator is wired (open API)", async () => {
    const handle = handlerWith({});
    const response = await send(handle, req("GET", "/admin/api/posts"));
    expect(response.status).toBe(200);
  });

  it("401s an unauthenticated request", async () => {
    const handle = handlerWith({ auth: bearerAuth });
    const response = await send(handle, req("GET", "/admin/api/posts"));
    expect(response.status).toBe(401);
    expect((await failureOf(response)).code).toBe("UNAUTHORIZED");
  });

  it("admits a request the authenticator recognises", async () => {
    const handle = handlerWith({ auth: bearerAuth });
    const response = await send(
      handle,
      req("GET", "/admin/api/posts", { headers: { authorization: "Bearer admin" } }),
    );
    expect(response.status).toBe(200);
  });

  it("authenticates before resolving the collection (401, not 404)", async () => {
    const handle = handlerWith({ auth: bearerAuth });
    const response = await send(handle, req("GET", "/admin/api/nope"));
    expect(response.status).toBe(401);
    expect((await failureOf(response)).code).toBe("UNAUTHORIZED");
  });

  it("never runs the guard on a route it doesn't own", async () => {
    const handle = handlerWith({ auth: bearerAuth });
    // `PUT` isn't a method this dispatcher serves → null fall-through, no 401.
    expect(await handle(req("PUT", "/admin/api/posts/p1"))).toBeNull();
    // Outside the base path → null, regardless of auth.
    expect(await handle(req("GET", "/other/posts"))).toBeNull();
  });
});

describe("RBAC access hook", () => {
  it("allows an operation the hook approves", async () => {
    const handle = handlerWith({ auth: bearerAuth, access: roleAccess });
    const response = await send(
      handle,
      req("POST", "/admin/api/posts", {
        headers: { authorization: "Bearer admin", "content-type": "application/json" },
        body: JSON.stringify({ data: { title: "New", slug: "new" } }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("403s an operation the hook denies, naming the collection + operation", async () => {
    const handle = handlerWith({ auth: bearerAuth, access: roleAccess });
    const response = await send(
      handle,
      req("POST", "/admin/api/posts", {
        headers: { authorization: "Bearer viewer", "content-type": "application/json" },
        body: JSON.stringify({ data: { title: "New", slug: "new" } }),
      }),
    );
    expect(response.status).toBe(403);
    const failure = await failureOf(response);
    expect(failure.code).toBe("FORBIDDEN");
    if (failure.code === "FORBIDDEN") {
      expect(failure.collectionSlug).toBe("posts");
      expect(failure.operation).toBe("create");
    }
  });

  it("still allows reads for a read-only principal", async () => {
    const handle = handlerWith({ auth: bearerAuth, access: roleAccess });
    const response = await send(
      handle,
      req("GET", "/admin/api/posts/p1", { headers: { authorization: "Bearer viewer" } }),
    );
    expect(response.status).toBe(200);
  });
});

describe("CSRF double-submit", () => {
  it("403s a mutating request with no token", async () => {
    const handle = handlerWith({ csrf: { secret: SECRET } });
    const response = await send(
      handle,
      req("POST", "/admin/api/posts", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { title: "x", slug: "x" } }),
      }),
    );
    expect(response.status).toBe(403);
    expect((await failureOf(response)).code).toBe("CSRF");
  });

  it("admits a mutating request with a valid signed token pair", async () => {
    const handle = handlerWith({ csrf: { secret: SECRET } });
    const token = await issueCsrfToken(SECRET);
    const response = await send(
      handle,
      req("POST", "/admin/api/posts", {
        headers: {
          "content-type": "application/json",
          cookie: `voila_csrf=${token}`,
          "x-csrf-token": token,
        },
        body: JSON.stringify({ data: { title: "x", slug: "x" } }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("exempts reads from the token check", async () => {
    const handle = handlerWith({ csrf: { secret: SECRET } });
    const response = await send(handle, req("GET", "/admin/api/posts"));
    expect(response.status).toBe(200);
  });

  it("checks CSRF before the RBAC hook on a forged write", async () => {
    // Authenticated admin (RBAC would allow) but no CSRF token → CSRF wins.
    const handle = handlerWith({ auth: bearerAuth, access: roleAccess, csrf: { secret: SECRET } });
    const response = await send(
      handle,
      req("POST", "/admin/api/posts", {
        headers: { authorization: "Bearer admin", "content-type": "application/json" },
        body: JSON.stringify({ data: { title: "x", slug: "x" } }),
      }),
    );
    expect(response.status).toBe(403);
    expect((await failureOf(response)).code).toBe("CSRF");
  });
});
