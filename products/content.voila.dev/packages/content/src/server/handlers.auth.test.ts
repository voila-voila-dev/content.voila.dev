/**
 * API-level session enforcement. Every `/admin/api/*` data handler gates on the
 * injected `auth` resolver: no session ⇒ `401 UNAUTHORIZED`, before any data
 * work. A read (`handleList`) and a write (`handleCreate`) stand in for the
 * whole surface. Handlers given no resolver skip enforcement — that path is
 * what the other handler suites exercise.
 */

import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { sqlite } from "@voila/content-database/sqlite";
import { fields } from "@voila/content-schema";
import { sql } from "drizzle-orm";
import { defineCollection, defineContent } from "../define.ts";
import type { ApiSessionResolver } from "./auth.ts";
import { CSRF_COOKIE, CSRF_HEADER, generateCsrfToken } from "./csrf.ts";
import { handleCreate, handleList } from "./handlers/index.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string({ required: true, unique: true }),
  },
});
const content = defineContent({ collections: [posts] });

const UUID = `(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))`;
const DDL = `CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL DEFAULT ${UUID}, "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000), "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000), "deleted_at" INTEGER, "title" TEXT NOT NULL, "slug" TEXT NOT NULL UNIQUE)`;

const SECRET = "test-csrf-secret";
const RealRequest = (globalThis as { NativeRequest?: typeof Request }).NativeRequest ?? Request;

// Resolvers stand in for the auth singleton: one allows, one denies.
const allow: ApiSessionResolver = { getSession: () => ({ user: { id: "u1" } }) };
const deny: ApiSessionResolver = { getSession: () => null };

let TOKEN: string;
let adapter: ReturnType<typeof sqlite>;

beforeAll(async () => {
  TOKEN = await generateCsrfToken(SECRET);
});
beforeEach(() => {
  adapter = sqlite({ url: ":memory:" });
  adapter.drizzle.run(sql.raw(DDL));
});

async function json(res: Response): Promise<{ status: number; body: any }> {
  return { status: res.status, body: await res.json() };
}

describe("read auth (handleList)", () => {
  const listReq = () => new RealRequest("http://localhost/admin/api/posts");

  test("401s when a resolver yields no session", async () => {
    const { status, body } = await json(
      await handleList({
        request: listReq(),
        params: { collection: "posts" },
        content,
        adapter,
        auth: deny,
      }),
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("proceeds (200) when the resolver yields a session", async () => {
    const { status } = await json(
      await handleList({
        request: listReq(),
        params: { collection: "posts" },
        content,
        adapter,
        auth: allow,
      }),
    );
    expect(status).toBe(200);
  });

  test("skips enforcement entirely when no resolver is injected", async () => {
    const { status } = await json(
      await handleList({ request: listReq(), params: { collection: "posts" }, content, adapter }),
    );
    expect(status).toBe(200);
  });
});

describe("write auth (handleCreate)", () => {
  function createReq() {
    const headers = new Headers({ "content-type": "application/json" });
    headers.set("cookie", `${CSRF_COOKIE}=${TOKEN}`);
    headers.set(CSRF_HEADER, TOKEN);
    return new RealRequest("http://localhost/admin/api/posts", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Hi", slug: "hi" }),
    });
  }

  test("401s when unauthenticated, even with a valid CSRF token", async () => {
    const { status, body } = await json(
      await handleCreate({
        request: createReq(),
        params: { collection: "posts" },
        content,
        adapter,
        csrfSecret: SECRET,
        auth: deny,
      }),
    );
    expect(status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("creates (201) when authenticated with a valid CSRF token", async () => {
    const { status } = await json(
      await handleCreate({
        request: createReq(),
        params: { collection: "posts" },
        content,
        adapter,
        csrfSecret: SECRET,
        auth: allow,
      }),
    );
    expect(status).toBe(201);
  });
});
