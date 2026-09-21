// External collections and operation switches through the full REST stack
// (`createRestHandler` → handlers → `makeDatabase` with a `CollectionSource`):
// list/get/findOne served from an in-memory source, `405 NOT_SUPPORTED` for an
// operation the collection switched off or the source doesn't implement (and
// for the table-only features asked of an external slug), the `readOnly` field
// rejection, and the saved-views routes still working for an external slug.
// The table-backed `posts` collection sits alongside over in-memory SQLite.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import type { Authenticator } from "../auth/authenticator";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import type { CollectionSource } from "../database/source";
import type { Document } from "../database/types";
import { makeViewStore } from "../views/store";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";
import { deriveSlugFields, validateWrite } from "./write";

// Table-backed, with deletion switched off at the collection level.
const posts = defineCollection({
  slug: "posts",
  operations: { delete: false },
  fields: {
    title: fields.string({ required: true }),
    // Owned by the host (a trigger, say): shown, never written from the API.
    views: fields.number({ readOnly: true }),
  },
});

// External and read-mostly: the source implements list/get/findOne/update only.
const customers = defineCollection({
  slug: "customers",
  external: true,
  fields: {
    name: fields.string({ required: true }),
    email: fields.string({ unique: true }),
    tier: fields.string(),
  },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts, customers } });

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
    for (const idx of table.indexes) {
      const idxCols = idx.columns.map((c) => `"${c}"`).join(", ");
      stmts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX "${idx.name}" ON "${idx.table}" (${idxCols})`,
      );
    }
  }
  return stmts;
}

const seed: ReadonlyArray<Document> = [
  { id: "c1", name: "Ada", email: "ada@example.com", tier: "gold", createdAt: 1000 },
  { id: "c2", name: "Grace", email: "grace@example.com", tier: "silver", createdAt: 2000 },
];

function memorySource(): CollectionSource {
  const rows = new Map<string, Document>(seed.map((doc) => [String(doc.id), doc]));
  return {
    list: async (opts) => {
      let docs = [...rows.values()];
      for (const filter of opts.filters ?? []) {
        docs = docs.filter((doc) =>
          filter.op === "eq" ? doc[filter.field] === filter.value : true,
        );
      }
      return { documents: docs, nextCursor: null, total: docs.length };
    },
    get: async (id) => rows.get(id) ?? null,
    findOne: async (field, value) => [...rows.values()].find((d) => d[field] === value) ?? null,
    update: async (id, values) => {
      const current = rows.get(id);
      if (current === undefined) return null;
      const next = { ...current, ...values };
      rows.set(id, next);
      return next;
    },
  };
}

// The caller's id comes from an `x-user` header (the `_views` routes need one).
const headerAuth: Authenticator = {
  authenticate: async (request) => {
    const id = request.headers.get("x-user");
    return id === null ? null : { id };
  },
};

let driver: SqliteDriver;
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = {
    config,
    database: makeDatabase(config, driver, { sources: { customers: memorySource() } }),
    views: { store: makeViewStore(driver) },
    // Nothing here is expected to 500; a 500 would print its cause otherwise.
    onError: () => {},
  };
  handle = createRestHandler(ctx, { basePath: "/admin/api", auth: headerAuth });
});

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await handle(
    new Request(`https://x/admin/api${path}`, {
      ...init,
      headers: { "x-user": "u1", ...(init.headers as Record<string, string>) },
    }),
  );
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

function json(method: string, data: unknown): RequestInit {
  return { method, body: JSON.stringify({ data }) };
}

async function dataOf<T>(response: Response): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}
async function errorOf(response: Response): Promise<ApiFailure> {
  return ((await response.json()) as { error: ApiFailure }).error;
}

async function expectNotSupported(
  response: Response,
  collectionSlug: string,
  operation: string,
): Promise<void> {
  expect(response.status).toBe(405);
  expect(await errorOf(response)).toEqual({ code: "NOT_SUPPORTED", collectionSlug, operation });
}

describe("external collection — reads through the source", () => {
  it("lists, counts and filters via the source", async () => {
    const response = await send("/customers?count=1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Document[]; nextCursor: null; total: number };
    expect(body.data.map((d) => d.id)).toEqual(["c1", "c2"]);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(2);

    const filtered = await dataOf<Document[]>(await send("/customers?filter=tier:eq:gold"));
    expect(filtered.map((d) => d.name)).toEqual(["Ada"]);
  });

  it("keeps the query validation the SQL path has", async () => {
    const order = await send("/customers?orderBy=nope");
    expect(order.status).toBe(400);
    expect(await errorOf(order)).toEqual({
      code: "INVALID_ORDER",
      collectionSlug: "customers",
      orderKey: "nope",
    });
    const filter = await send("/customers?filter=zip:eq:1");
    expect(filter.status).toBe(400);
    expect((await errorOf(filter)).code).toBe("BAD_REQUEST");
  });

  it("gets by id and by unique field", async () => {
    expect(await dataOf<Document>(await send("/customers/c2"))).toMatchObject({ name: "Grace" });
    expect((await send("/customers/nope")).status).toBe(404);
    expect(await dataOf<Document>(await send("/customers/by/email/ada@example.com"))).toMatchObject(
      { name: "Ada" },
    );
  });

  it("patches through the source's update", async () => {
    const response = await send("/customers/c1", json("PATCH", { tier: "platinum" }));
    expect(response.status).toBe(200);
    expect(await dataOf<Document>(response)).toMatchObject({ id: "c1", tier: "platinum" });
    expect((await send("/customers/nope", json("PATCH", { tier: "x" }))).status).toBe(404);
  });
});

describe("external collection — 405 for what the source doesn't offer", () => {
  it("create/delete/search", async () => {
    await expectNotSupported(
      await send("/customers", json("POST", { name: "Linus" })),
      "customers",
      "create",
    );
    await expectNotSupported(
      await send("/customers/c1", { method: "DELETE" }),
      "customers",
      "delete",
    );
    await expectNotSupported(await send("/customers/search?q=ada"), "customers", "search");
  });

  it("the table-only features (restore, publish, revisions)", async () => {
    await expectNotSupported(
      await send("/customers/c1/restore", { method: "POST" }),
      "customers",
      "restore",
    );
    await expectNotSupported(
      await send("/customers/c1/publish", { method: "POST" }),
      "customers",
      "publish",
    );
    await expectNotSupported(
      await send("/customers/c1/unpublish", { method: "POST" }),
      "customers",
      "publish",
    );
    await expectNotSupported(await send("/customers/c1/revisions"), "customers", "listRevisions");
    await expectNotSupported(await send("/customers/c1/revisions/1"), "customers", "getRevision");
    await expectNotSupported(
      await send("/customers/c1/revisions/1/restore", { method: "POST" }),
      "customers",
      "restoreRevision",
    );
  });
});

describe("collection-level operation switches", () => {
  it("answers 405 for a switched-off operation on a table-backed collection", async () => {
    const created = await dataOf<Document>(await send("/posts", json("POST", { title: "Hi" })));
    const response = await send(`/posts/${created.id}`, { method: "DELETE" });
    await expectNotSupported(response, "posts", "delete");
    // Restore is the flip side of delete, so it shares the switch.
    await expectNotSupported(
      await send(`/posts/${created.id}/restore`, { method: "POST" }),
      "posts",
      "delete",
    );
    // The switched-on operations keep working.
    const patched = await send(`/posts/${created.id}`, json("PATCH", { title: "Hey" }));
    expect(patched.status).toBe(200);
  });

  it("has a human-readable message on the envelope", async () => {
    const response = await send("/customers", json("POST", { name: "x" }));
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe('"customers" does not support "create".');
  });
});

describe("readOnly fields", () => {
  it("does not require a required readOnly field on a full write", () => {
    // Typical of an external source: the value is always present on read but
    // the source computes it, so a create payload can never carry it.
    const entry = {
      slug: "customers",
      fields: {
        name: fields.string({ required: true }),
        score: fields.number({ required: true, readOnly: true }),
      },
    };
    expect(validateWrite(entry, { name: "Ada" }, { partial: false })).toEqual({ name: "Ada" });
  });

  it("does not derive a readOnly slug (the source owns it)", () => {
    const entry = {
      slug: "customers",
      fields: {
        name: fields.string({ required: true }),
        handle: fields.slug({ from: "name", readOnly: true }),
      },
    };
    const body = { name: "Ada Lovelace" };
    expect(deriveSlugFields(entry, body)).toBe(body);
  });

  it("rejects a payload naming a readOnly field with a 403 listing it", async () => {
    const created = await dataOf<Document>(await send("/posts", json("POST", { title: "Hi" })));
    for (const response of [
      await send("/posts", json("POST", { title: "Again", views: 3 })),
      await send(`/posts/${created.id}`, json("PATCH", { views: 3 })),
    ]) {
      expect(response.status).toBe(403);
      expect(await errorOf(response)).toEqual({
        code: "FORBIDDEN",
        collectionSlug: "posts",
        operation: expect.stringMatching(/create|update/),
        issues: [{ path: ["views"], message: "Not allowed." }],
      });
    }
  });
});

describe("saved views on an external collection", () => {
  it("creates and lists views under /customers/_views", async () => {
    const created = await dataOf<{ id: string; name: string }>(
      await send("/customers/_views", json("POST", { name: "Gold", type: "table", config: {} })),
    );
    expect(created.name).toBe("Gold");
    const listed = await dataOf<Array<{ name: string }>>(await send("/customers/_views"));
    // The default Table view is seeded on first list, like any collection.
    expect(listed.map((v) => v.name).sort()).toEqual(["Gold", "Table"]);
  });
});
