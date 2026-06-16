// Per-field access enforcement, driven end to end through `createRestHandler`
// over a real (in-memory) SQLite `Database`: read-denied fields are redacted
// from every serialization (lists, finds, write echoes, revision snapshots),
// write-denied fields reject the payload with a 403 naming them, and a
// revision restore requires write access to every guarded field.

import { beforeEach, describe, expect, it } from "bun:test";
import {
  defineCollection,
  defineConfig,
  type FieldAccessContext,
  fields,
  type NormalizedConfig,
} from "@voila/content";
import { deriveSchema } from "../../sql";
import type { Authenticator } from "../auth/authenticator";
import type { Principal } from "../auth/principal";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import type { Database, Document, Revision } from "../database/types";
import type { ApiFailure } from "./errors";
import { readAccessContext, redactDocument } from "./field-access";
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";

const isAdmin = (ctx: FieldAccessContext): boolean =>
  ctx.principal?.roles?.includes("admin") ?? false;

const posts = defineCollection({
  slug: "posts",
  revisions: true,
  fields: {
    title: fields.string({ required: true }),
    // Only admins may *see* this one; anyone may write it.
    secret: fields.string({ unique: true, access: { read: isAdmin } }),
    // Anyone may see this one; only admins may write it.
    locked: fields.string({ access: { write: isAdmin } }),
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
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
  }
  return stmts;
}

const ADMIN: Principal = { id: "u1", roles: ["admin"] };
const VIEWER: Principal = { id: "u2", roles: ["viewer"] };

const bearerAuth: Authenticator = {
  async authenticate(request) {
    const who = request.headers.get("authorization");
    if (who === "Bearer admin") return ADMIN;
    if (who === "Bearer viewer") return VIEWER;
    return null;
  },
};

let database: Database;
let handle: (request: Request) => Promise<Response | null>;
let openHandle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  const driver: SqliteDriver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  database = makeDatabase(config, driver);
  const ctx: RestContext = { config, database };
  handle = createRestHandler(ctx, { basePath: "/admin/api", auth: bearerAuth });
  // No authenticator wired: every request runs with `principal: null`.
  openHandle = createRestHandler(ctx, { basePath: "/admin/api" });
});

type Caller = "admin" | "viewer";

async function send(
  path: string,
  opts: { method?: string; as?: Caller; body?: unknown; open?: boolean } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.as) headers.authorization = `Bearer ${opts.as}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const dispatch = opts.open ? openHandle : handle;
  const response = await dispatch(
    new Request(`https://x/admin/api${path}`, {
      method: opts.method ?? "GET",
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    }),
  );
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

async function dataOf<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

async function errorOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

async function seed(): Promise<string> {
  const created = await database.create("posts", {
    title: "Hello",
    secret: "s3cret",
    locked: "ours",
  });
  return created.id as string;
}

describe("read redaction", () => {
  it("redacts a read-denied field from a list, per caller", async () => {
    await seed();
    const viewerRows = await dataOf<Document[]>(await send("/posts", { as: "viewer" }));
    expect(viewerRows[0]?.title).toBe("Hello");
    expect(viewerRows[0]?.locked).toBe("ours");
    expect(viewerRows[0]).not.toHaveProperty("secret");

    const adminRows = await dataOf<Document[]>(await send("/posts", { as: "admin" }));
    expect(adminRows[0]?.secret).toBe("s3cret");
  });

  it("redacts on find-by-id", async () => {
    const id = await seed();
    const row = await dataOf<Document>(await send(`/posts/${id}`, { as: "viewer" }));
    expect(row).not.toHaveProperty("secret");
    expect(row.id).toBe(id);
  });

  it("redacts for an unauthenticated caller on an open API (principal null)", async () => {
    await seed();
    const rows = await dataOf<Document[]>(await send("/posts", { open: true }));
    expect(rows[0]).not.toHaveProperty("secret");
  });

  it("denies a lookup *by* a read-denied unique field", async () => {
    await seed();
    const res = await send("/posts/by/secret/s3cret", { as: "viewer" });
    expect(res.status).toBe(403);
    const failure = await errorOf(res);
    expect(failure.code).toBe("FORBIDDEN");
    if (failure.code === "FORBIDDEN")
      expect(failure.issues).toEqual([{ path: ["secret"], message: "Not allowed." }]);
  });

  it("allows the same lookup for a caller who can read the field", async () => {
    await seed();
    const res = await send("/posts/by/secret/s3cret", { as: "admin" });
    expect(res.status).toBe(200);
    expect((await dataOf<Document>(res)).secret).toBe("s3cret");
  });
});

describe("write denial", () => {
  it("403s a create whose payload touches a write-denied field, naming it", async () => {
    const res = await send("/posts", {
      method: "POST",
      as: "viewer",
      body: { data: { title: "New", locked: "nope" } },
    });
    expect(res.status).toBe(403);
    const failure = await errorOf(res);
    expect(failure.code).toBe("FORBIDDEN");
    if (failure.code === "FORBIDDEN") {
      expect(failure.collectionSlug).toBe("posts");
      expect(failure.operation).toBe("create");
      expect(failure.issues).toEqual([{ path: ["locked"], message: "Not allowed." }]);
    }
  });

  it("admits the create once the denied field is dropped — and redacts the echo", async () => {
    const res = await send("/posts", {
      method: "POST",
      as: "viewer",
      body: { data: { title: "New", secret: "mine" } },
    });
    expect(res.status).toBe(201);
    const row = await dataOf<Document>(res);
    expect(row.title).toBe("New");
    // The viewer may *write* `secret` but not read it back.
    expect(row).not.toHaveProperty("secret");
  });

  it("403s an update touching a write-denied field; allows it for an admin", async () => {
    const id = await seed();
    const denied = await send(`/posts/${id}`, {
      method: "PATCH",
      as: "viewer",
      body: { data: { locked: "mine now" } },
    });
    expect(denied.status).toBe(403);
    const failure = await errorOf(denied);
    if (failure.code === "FORBIDDEN") {
      expect(failure.operation).toBe("update");
      expect(failure.issues).toEqual([{ path: ["locked"], message: "Not allowed." }]);
    }

    const allowed = await send(`/posts/${id}`, {
      method: "PATCH",
      as: "admin",
      body: { data: { locked: "rotated" } },
    });
    expect(allowed.status).toBe(200);
    expect((await dataOf<Document>(allowed)).locked).toBe("rotated");
  });

  it("redacts the echo of a soft-delete restore", async () => {
    const id = await seed();
    await send(`/posts/${id}`, { method: "DELETE", as: "viewer" });
    const res = await send(`/posts/${id}/restore`, { method: "POST", as: "viewer" });
    expect(res.status).toBe(200);
    expect(await dataOf<Document>(res)).not.toHaveProperty("secret");
  });
});

describe("version history", () => {
  it("redacts revision snapshots in list and single-revision reads", async () => {
    const id = await seed();
    await database.update("posts", id, { title: "v2" });

    const list = await dataOf<Revision[]>(await send(`/posts/${id}/revisions`, { as: "viewer" }));
    expect(list.length).toBe(2);
    for (const revision of list) expect(revision.doc).not.toHaveProperty("secret");

    const one = await dataOf<Revision>(await send(`/posts/${id}/revisions/1`, { as: "viewer" }));
    expect(one.doc).not.toHaveProperty("secret");
    expect(one.doc.title).toBe("Hello");

    const adminOne = await dataOf<Revision>(
      await send(`/posts/${id}/revisions/1`, { as: "admin" }),
    );
    expect(adminOne.doc.secret).toBe("s3cret");
  });

  it("denies a revision restore to a caller lacking write on a guarded field", async () => {
    const id = await seed();
    await database.update("posts", id, { title: "v2" });

    const denied = await send(`/posts/${id}/revisions/1/restore`, { method: "POST", as: "viewer" });
    expect(denied.status).toBe(403);
    const failure = await errorOf(denied);
    expect(failure.code).toBe("FORBIDDEN");
    if (failure.code === "FORBIDDEN")
      expect(failure.issues).toEqual([{ path: ["locked"], message: "Not allowed." }]);

    const allowed = await send(`/posts/${id}/revisions/1/restore`, { method: "POST", as: "admin" });
    expect(allowed.status).toBe(200);
    expect((await dataOf<Document>(allowed)).title).toBe("Hello");
  });
});

describe("redactDocument", () => {
  it("returns the same row reference when nothing is redacted", async () => {
    const id = await seed();
    const row = await database.get("posts", id);
    if (row === null) throw new Error("seed row missing");
    const entry = { slug: "posts", fields: posts.fields };
    expect(redactDocument(entry, row, readAccessContext("posts", ADMIN, id))).toBe(row);
    expect(redactDocument(entry, row, readAccessContext("posts", VIEWER, id))).not.toBe(row);
  });
});
