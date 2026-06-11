// Version-history routes over a real (in-memory) SQLite `Database`, driven
// through the `createRestHandler` dispatcher so routing, query parsing, the
// envelope shapes, and the guard classification (history reads are `read`,
// revision restore is a CSRF-checked `update`) are exercised end to end.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeDatabase } from "../database/database";
import { makeSqliteDriver, type SqliteDriver } from "../database/sqlite-driver";
import type { Database, Revision } from "../database/types";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import { createRestHandler } from "./router";

const posts = defineCollection({
  slug: "posts",
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
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
  }
  return stmts;
}

let database: Database;
let handle: (request: Request) => Promise<Response | null>;

beforeEach(async () => {
  const driver: SqliteDriver = makeSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  database = makeDatabase(config, driver);
  const ctx: RestContext = { config, database };
  handle = createRestHandler(ctx, { basePath: "/admin/api" });
});

async function send(path: string, method = "GET"): Promise<Response> {
  const response = await handle(new Request(`https://x/admin/api${path}`, { method }));
  if (response === null) throw new Error(`route not matched: ${method} ${path}`);
  return response;
}

async function errorOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

// Seed a post with three revisions (v1 → v2 → v3) and return its id.
async function seed(): Promise<string> {
  const created = await database.create("posts", { title: "v1" });
  const id = created.id as string;
  await database.update("posts", id, { title: "v2" });
  await database.update("posts", id, { title: "v3" });
  return id;
}

describe("GET /:collection/:id/revisions", () => {
  it("lists history newest-first with the list envelope", async () => {
    const id = await seed();
    const res = await send(`/posts/${id}/revisions`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: ReadonlyArray<Revision>;
      nextCursor: string | null;
    };
    expect(body.data.map((r) => r.rev)).toEqual([3, 2, 1]);
    expect(body.data.map((r) => r.doc.title)).toEqual(["v3", "v2", "v1"]);
    expect(body.nextCursor).toBeNull();
  });

  it("pages with limit + cursor", async () => {
    const id = await seed();
    const first = await send(`/posts/${id}/revisions?limit=2`);
    const page1 = (await first.json()) as { data: ReadonlyArray<Revision>; nextCursor: string };
    expect(page1.data.map((r) => r.rev)).toEqual([3, 2]);
    expect(page1.nextCursor).toBe("2");

    const second = await send(`/posts/${id}/revisions?limit=2&cursor=${page1.nextCursor}`);
    const page2 = (await second.json()) as {
      data: ReadonlyArray<Revision>;
      nextCursor: string | null;
    };
    expect(page2.data.map((r) => r.rev)).toEqual([1]);
    expect(page2.nextCursor).toBeNull();
  });

  it("rejects a non-numeric cursor as INVALID_CURSOR", async () => {
    const id = await seed();
    const res = await send(`/posts/${id}/revisions?cursor=garbage`);
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("INVALID_CURSOR");
  });

  it("a collection that didn't opt in is a BAD_REQUEST", async () => {
    const page = await database.create("pages", { title: "About" });
    const res = await send(`/pages/${page.id as string}/revisions`);
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("BAD_REQUEST");
  });

  it("an unknown collection is UNKNOWN_COLLECTION", async () => {
    const res = await send("/nope/x/revisions");
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("UNKNOWN_COLLECTION");
  });
});

describe("GET /:collection/:id/revisions/:rev", () => {
  it("fetches one revision", async () => {
    const id = await seed();
    const res = await send(`/posts/${id}/revisions/1`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Revision };
    expect(body.data.rev).toBe(1);
    expect(body.data.doc.title).toBe("v1");
  });

  it("a missing revision is NOT_FOUND", async () => {
    const id = await seed();
    const res = await send(`/posts/${id}/revisions/99`);
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("NOT_FOUND");
  });

  it("a malformed rev segment is a BAD_REQUEST", async () => {
    const id = await seed();
    for (const raw of ["abc", "0", "-1", "1.5"]) {
      const res = await send(`/posts/${id}/revisions/${raw}`);
      expect(res.status).toBe(400);
      expect((await errorOf(res)).code).toBe("BAD_REQUEST");
    }
  });
});

describe("POST /:collection/:id/revisions/:rev/restore", () => {
  it("re-applies the revision's content and echoes the stored row", async () => {
    const id = await seed();
    const res = await send(`/posts/${id}/revisions/1/restore`, "POST");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { title: string } };
    expect(body.data.title).toBe("v1");
    // The restore appended a fourth revision.
    const { revisions } = await database.listRevisions("posts", id);
    expect(revisions.map((r) => r.rev)).toEqual([4, 3, 2, 1]);
  });

  it("a missing revision is NOT_FOUND", async () => {
    const id = await seed();
    const res = await send(`/posts/${id}/revisions/99/restore`, "POST");
    expect(res.status).toBe(404);
    expect((await errorOf(res)).code).toBe("NOT_FOUND");
  });

  it("is CSRF-guarded like any other write, while history reads are exempt", async () => {
    const id = await seed();
    const guarded = createRestHandler(
      { config, database },
      { basePath: "/admin/api", csrf: { secret: "test-secret" } },
    );
    const denied = await guarded(
      new Request(`https://x/admin/api/posts/${id}/revisions/1/restore`, { method: "POST" }),
    );
    expect(denied?.status).toBe(403);
    expect(((await denied?.json()) as { error: ApiFailure }).error.code).toBe("CSRF");

    const read = await guarded(new Request(`https://x/admin/api/posts/${id}/revisions`));
    expect(read?.status).toBe(200);
  });
});
