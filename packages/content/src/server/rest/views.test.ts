// The `_views` routes end to end through `createRestHandler`: per-user CRUD over
// the `voila_views` store, the owner taken only from the resolved principal
// (never the body), the 401 for an unauthenticated caller, and the CSRF guard on
// writes. The table comes from `deriveSchema`; the store runs over in-memory
// SQLite — the same seams production uses.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import type { Authenticator } from "../auth/authenticator";
import { issueCsrfToken } from "../auth/csrf";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import { makeViewStore } from "../views/store";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import { createRestHandler, type RestHandlerOptions } from "./router";
import type { ViewsContext } from "./views";

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

// A test authenticator: the caller's id comes from an `x-user` header (absent →
// unauthenticated, returning `null` so the guard 401s).
const headerAuth: Authenticator = {
  authenticate: async (request) => {
    const id = request.headers.get("x-user");
    return id === null ? null : { id };
  },
};

let driver: SqliteDriver;
let views: ViewsContext;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  views = { store: makeViewStore(driver) };
});

function handler(options: RestHandlerOptions = {}): (r: Request) => Promise<Response | null> {
  const ctx: RestContext = { config, database: makeDatabase(config, driver), views };
  return createRestHandler(ctx, { basePath: "/admin/api", ...options });
}

async function send(
  handle: (r: Request) => Promise<Response | null>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await handle(new Request(`https://x/admin/api${path}`, init));
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

async function dataOf<T>(response: Response): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}
async function errorOf(response: Response): Promise<ApiFailure> {
  return ((await response.json()) as { error: ApiFailure }).error;
}

function asUser(id: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { "x-user": id, ...(init.headers as Record<string, string>) } };
}

interface WireView {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  readonly type: string;
}

describe("_views routes — CRUD", () => {
  it("creates, lists, updates and deletes a view scoped to the principal", async () => {
    const handle = handler({ auth: headerAuth });

    const created = await dataOf<WireView>(
      await send(
        handle,
        "/posts/_views",
        asUser("u1", {
          method: "POST",
          body: JSON.stringify({ data: { name: "Recent", type: "table", config: {} } }),
        }),
      ),
    );
    expect(created.ownerId).toBe("u1");

    const listed = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")));
    expect(listed.map((v) => v.name)).toEqual(["Recent"]);

    const updated = await dataOf<WireView>(
      await send(
        handle,
        `/posts/_views/${created.id}`,
        asUser("u1", { method: "PATCH", body: JSON.stringify({ data: { name: "Renamed" } }) }),
      ),
    );
    expect(updated.name).toBe("Renamed");

    await send(handle, `/posts/_views/${created.id}`, asUser("u1", { method: "DELETE" }));
    expect(await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")))).toEqual([]);
  });

  it("ignores any owner in the body — the principal owns the view", async () => {
    const handle = handler({ auth: headerAuth });
    const created = await dataOf<WireView>(
      await send(
        handle,
        "/posts/_views",
        asUser("u1", {
          method: "POST",
          body: JSON.stringify({ data: { name: "X", type: "table", config: {}, ownerId: "u2" } }),
        }),
      ),
    );
    expect(created.ownerId).toBe("u1");
  });
});

describe("_views routes — owner isolation", () => {
  it("never exposes or mutates another user's views", async () => {
    const handle = handler({ auth: headerAuth });
    const u1View = await dataOf<WireView>(
      await send(
        handle,
        "/posts/_views",
        asUser("u1", {
          method: "POST",
          body: JSON.stringify({ data: { name: "Mine", type: "table", config: {} } }),
        }),
      ),
    );

    // u2's list is empty.
    expect(await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u2")))).toEqual([]);
    // u2 can't update or delete u1's view → 404 (it's not theirs).
    const patch = await send(
      handle,
      `/posts/_views/${u1View.id}`,
      asUser("u2", { method: "PATCH", body: JSON.stringify({ data: { name: "Hacked" } }) }),
    );
    expect(patch.status).toBe(404);
    // u1's view is untouched.
    const stillMine = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")));
    expect(stillMine[0]?.name).toBe("Mine");
  });
});

describe("_views routes — guard", () => {
  it("401s an unauthenticated caller (no owner to attach the view to)", async () => {
    // Auth wired but no `x-user` → principal null → guard 401.
    const handle = handler({ auth: headerAuth });
    const res = await send(handle, "/posts/_views");
    expect(res.status).toBe(401);
  });

  it("401s when the API is open (no principal) at the handler", async () => {
    // No auth wired → guard passes with a null principal → the handler 401s,
    // since a view needs an owner.
    const handle = handler();
    const res = await send(handle, "/posts/_views");
    expect(res.status).toBe(401);
    expect((await errorOf(res)).code).toBe("UNAUTHORIZED");
  });

  it("CSRF-checks writes like any other mutation", async () => {
    const SECRET = "views-test-secret";
    const handle = handler({ auth: headerAuth, csrf: { secret: SECRET } });

    const blocked = await send(
      handle,
      "/posts/_views",
      asUser("u1", {
        method: "POST",
        body: JSON.stringify({ data: { name: "X", type: "table", config: {} } }),
      }),
    );
    expect(blocked.status).toBe(403);
    expect((await errorOf(blocked)).code).toBe("CSRF");

    const token = await issueCsrfToken(SECRET);
    const allowed = await send(
      handle,
      "/posts/_views",
      asUser("u1", {
        method: "POST",
        body: JSON.stringify({ data: { name: "X", type: "table", config: {} } }),
        headers: { cookie: `voila_csrf=${token}`, "x-csrf-token": token },
      }),
    );
    expect(allowed.status).toBe(201);
  });

  it("does not own the `_views` routes when no views context is wired", async () => {
    const ctx: RestContext = { config, database: makeDatabase(config, driver) };
    const handle = createRestHandler(ctx, { basePath: "/admin/api" });
    expect(await handle(new Request("https://x/admin/api/posts/_views"))).toBeNull();
  });
});
