// End-to-end Better Auth bridge: a real magic-link round-trip over an in-memory
// SQLite connection that holds both the auth tables and a content table. Proves
// the whole chain — request a link → mailer captures it → verify mints a session
// → the `Authenticator` resolves a `Principal` from the session cookie → that
// authenticator, wired into `createRestHandler`, gates the content API.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { authTableStatements, deriveSchema } from "../../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "../../database/bun-sqlite-driver";
import { makeDatabase } from "../../database/database";
import type { RestContext } from "../../rest/handlers";
import { createRestHandler } from "../../rest/router";
import { type BetterAuthBridge, makeBetterAuth } from "./instance";
import type { MagicLinkMessage, Mailer } from "./mailer";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }) },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

function contentSchema(cfg: NormalizedConfig): ReadonlyArray<string> {
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
  }
  return stmts;
}

// A 32+ char high-entropy secret keeps Better Auth from logging a weak-secret
// warning during the suite.
const SECRET = "tZ8qf2Lm9Wx4Rv7Np1Cy6Bk3Hs5Jd0Qe";
const BASE_URL = "http://localhost:3000";

let driver: SqliteDriver;
let bridge: BetterAuthBridge;
let inbox: MagicLinkMessage[];

const capturingMailer: Mailer = {
  id: "capture",
  async send(message) {
    inbox.push(message);
  },
};

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of authTableStatements) await driver.run(statement);
  for (const statement of contentSchema(config)) await driver.run(statement);
  await driver.run("INSERT INTO posts (id, title, created_at) VALUES (?, ?, ?)", [
    "p1",
    "Hi",
    1000,
  ]);
  inbox = [];
  bridge = makeBetterAuth({ secret: SECRET, driver, mailer: capturingMailer, baseUrl: BASE_URL });
});

// Run the full sign-in: request a magic link for `email`, follow the verify URL
// the mailer captured, and return the session cookie the verify response set.
async function signIn(email: string): Promise<string> {
  const ok = await bridge.instance.api.signInMagicLink({ body: { email }, headers: new Headers() });
  expect(ok.status).toBe(true);
  const message = inbox.at(-1);
  if (!message) throw new Error("no magic link was sent");
  const verify = await bridge.handler(new Request(message.url));
  const setCookie = verify.headers.get("set-cookie");
  if (!setCookie) throw new Error("verify did not set a session cookie");
  return setCookie.split(";")[0] as string;
}

describe("magic-link sign-in", () => {
  it("delivers a verify link carrying a token", async () => {
    await bridge.instance.api.signInMagicLink({
      body: { email: "user@x.dev" },
      headers: new Headers(),
    });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.to).toBe("user@x.dev");
    expect(inbox[0]?.url).toContain(`${bridge.basePath}/magic-link/verify`);
    expect(inbox[0]?.token).toBeTruthy();
  });

  it("mints a session whose cookie resolves to a Principal", async () => {
    const cookie = await signIn("user@x.dev");
    const principal = await bridge.authenticator.authenticate(
      new Request(`${BASE_URL}/admin/api/posts`, { headers: { cookie } }),
    );
    expect(principal).not.toBeNull();
    expect(principal?.email).toBe("user@x.dev");
    expect(principal?.id).toBeTruthy();
  });
});

describe("authenticator (the seam)", () => {
  it("returns null with no cookie", async () => {
    const principal = await bridge.authenticator.authenticate(
      new Request(`${BASE_URL}/admin/api/posts`),
    );
    expect(principal).toBeNull();
  });

  it("returns null for a garbage session cookie (fails soft, not 500)", async () => {
    const principal = await bridge.authenticator.authenticate(
      new Request(`${BASE_URL}/admin/api/posts`, {
        headers: { cookie: "better-auth.session_token=not-a-real-token" },
      }),
    );
    expect(principal).toBeNull();
  });
});

describe("wired into createRestHandler", () => {
  let handle: (request: Request) => Promise<Response | null>;

  beforeEach(() => {
    const ctx: RestContext = { config, database: makeDatabase(config, driver) };
    handle = createRestHandler(ctx, { basePath: "/admin/api", auth: bridge.authenticator });
  });

  it("401s an unauthenticated content request", async () => {
    const response = await handle(new Request(`${BASE_URL}/admin/api/posts`));
    expect(response?.status).toBe(401);
  });

  it("serves the content request once signed in", async () => {
    const cookie = await signIn("user@x.dev");
    const response = await handle(
      new Request(`${BASE_URL}/admin/api/posts`, { headers: { cookie } }),
    );
    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { data: ReadonlyArray<{ title: string }> };
    expect(body.data[0]?.title).toBe("Hi");
  });
});
