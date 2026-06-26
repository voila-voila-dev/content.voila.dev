// The `_views` routes end to end through `createRestHandler`: SHARED CRUD over
// the `voila_views` store (any signed-in caller sees and edits the same views;
// the creator id comes only from the resolved principal, never the body), the
// seeded default Table view, the 401 for an unauthenticated caller, and the CSRF
// guard on writes. The table comes from `deriveSchema`; the store runs over
// in-memory SQLite — the same seams production uses.

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
  it("creates, lists, updates and deletes a view (records the creator)", async () => {
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

    // The list seeds the undeletable default Table view, so it appears alongside.
    const listed = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")));
    expect(listed.map((v) => v.name).sort()).toEqual(["Recent", "Table"]);

    const updated = await dataOf<WireView>(
      await send(
        handle,
        `/posts/_views/${created.id}`,
        asUser("u1", { method: "PATCH", body: JSON.stringify({ data: { name: "Renamed" } }) }),
      ),
    );
    expect(updated.name).toBe("Renamed");

    await send(handle, `/posts/_views/${created.id}`, asUser("u1", { method: "DELETE" }));
    // Only the seeded default remains.
    const after = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")));
    expect(after.map((v) => v.name)).toEqual(["Table"]);
  });

  it("reorders the collection's views from an ordered id list", async () => {
    const handle = handler({ auth: headerAuth });
    const a = await dataOf<WireView>(
      await send(
        handle,
        "/posts/_views",
        asUser("u1", {
          method: "POST",
          body: JSON.stringify({ data: { name: "A", type: "table", config: {} } }),
        }),
      ),
    );
    const seeded = (
      await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")))
    ).find((v) => v.name === "Table");

    await send(
      handle,
      "/posts/_views/reorder",
      asUser("u1", { method: "POST", body: JSON.stringify({ data: { ids: [a.id, seeded?.id] } }) }),
    );
    const listed = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")));
    expect(listed.map((v) => v.name)).toEqual(["A", "Table"]);
  });

  it("ignores any owner in the body — the creator is the principal", async () => {
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

describe("_views routes — shared across users", () => {
  it("lets any signed-in user see and edit another user's view", async () => {
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

    // u2 sees u1's view (shared) alongside the seeded default.
    const u2List = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u2")));
    expect(u2List.map((v) => v.name).sort()).toEqual(["Mine", "Table"]);

    // u2 can edit it; the creator id is unchanged.
    const patched = await dataOf<WireView>(
      await send(
        handle,
        `/posts/_views/${u1View.id}`,
        asUser("u2", { method: "PATCH", body: JSON.stringify({ data: { name: "Edited" } }) }),
      ),
    );
    expect(patched.name).toBe("Edited");
    expect(patched.ownerId).toBe("u1");
  });

  it("treats deleting the seeded default as a no-op", async () => {
    const handle = handler({ auth: headerAuth });
    // Seed by listing, then find the default's id.
    const seeded = (
      await dataOf<(WireView & { seeded: boolean })[]>(
        await send(handle, "/posts/_views", asUser("u1")),
      )
    ).find((v) => v.seeded);
    expect(seeded).toBeDefined();
    await send(handle, `/posts/_views/${seeded?.id}`, asUser("u1", { method: "DELETE" }));
    const after = await dataOf<WireView[]>(await send(handle, "/posts/_views", asUser("u1")));
    expect(after.map((v) => v.name)).toEqual(["Table"]);
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
