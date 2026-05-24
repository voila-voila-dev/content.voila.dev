/**
 * Regression tests for bugs called out in the self-review:
 *
 *   B1 — secure cookies on http break local dev
 *   B6 — magic-link POST returns JSON, not a redirect (LoginView must use fetch)
 *   Q1 — generated singleton must read `content.auth` instead of hard-coding
 *   B8 — voila CLI must expose a way to install bundled auth migrations
 *
 * Every test asserts the *fixed* behaviour, so a regression in any of those
 * areas turns the file red.
 */

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { consoleMailer } from "./mailers/console.ts";
import { createAuth, isSecureBaseUrl, mergeBetterAuthOptions } from "./server.ts";
import { DEFAULT_AUTH_CONFIG, resolveAuthConfig } from "./types.ts";

const MIGRATION = readFileSync(
  join(import.meta.dir, "..", "migrations", "0000_auth_init.sqlite.sql"),
  "utf8",
);

function buildAuth(baseUrl: string | undefined, extra?: Partial<Parameters<typeof createAuth>[0]>) {
  const handle = new Database(":memory:");
  handle.exec(MIGRATION);
  return {
    auth: createAuth({
      config: DEFAULT_AUTH_CONFIG,
      adapter: { dialect: "sqlite" as const, drizzle: drizzle(handle) },
      secret: "0123456789abcdef0123456789abcdef",
      env: {},
      mailer: consoleMailer({ log() {} }),
      baseUrl,
      ...extra,
    }),
    close: () => handle.close(),
  };
}

describe("B1 — secure cookie attribute follows baseUrl protocol", () => {
  test("http baseUrl ⇒ secure:false (cookie is sent on localhost)", () => {
    const { auth, close } = buildAuth("http://localhost:8787");
    expect(auth.options.advanced?.defaultCookieAttributes?.secure).toBe(false);
    close();
  });

  test("https baseUrl ⇒ secure:true (production stays locked)", () => {
    const { auth, close } = buildAuth("https://admin.example.com");
    expect(auth.options.advanced?.defaultCookieAttributes?.secure).toBe(true);
    close();
  });

  test("isSecureBaseUrl: absent URL falls back to secure:true (safest default)", () => {
    expect(isSecureBaseUrl(undefined)).toBe(true);
  });

  test("isSecureBaseUrl: malformed URL falls back to secure:true", () => {
    expect(isSecureBaseUrl("not a url")).toBe(true);
  });
});

describe("B6 — magic-link endpoint still returns JSON (LoginView must fetch)", () => {
  test("POST /sign-in/magic-link responds with application/json, not a 3xx", async () => {
    const { auth, close } = buildAuth("https://app.example.com");
    const res = await auth.handler(
      new Request("https://app.example.com/admin/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", callbackURL: "/admin" }),
      }),
    );
    expect(res.status).not.toBe(302);
    expect(res.status).not.toBe(303);
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    close();
  });

  test("LoginView renders a form whose onSubmit is wired (no bare action=)", async () => {
    const src = readFileSync(
      join(import.meta.dir, "..", "..", "content", "src", "admin", "login-view.tsx"),
      "utf8",
    );
    expect(src).toContain("onSubmit");
    expect(src).toContain('await fetch("/admin/api/auth/sign-in/magic-link"');
    // No more plain HTML POST handing the user a JSON page.
    expect(src).not.toMatch(/method="POST"\s+action="\/admin\/api\/auth\/sign-in\/magic-link"/);
  });
});

describe("Q1 — generated singleton reads content.auth", () => {
  test("authSingletonSource flows content.auth through resolveAuthConfig", async () => {
    const { authSingletonSource } = await import("../../content/src/routes/admin-api-auth.ts");
    const src: string = authSingletonSource("../../content.config");
    expect(src).toContain("resolveAuthConfig(content.auth)");
    expect(src).not.toContain('providers: ["email"]');
  });
});

describe("authentication escape hatch", () => {
  test("mergeBetterAuthOptions appends user plugins and shallow-merges advanced", () => {
    const facadePlugin = { id: "facade" };
    const userPlugin = { id: "user" };
    const merged = mergeBetterAuthOptions(
      {
        plugins: [facadePlugin],
        advanced: { defaultCookieAttributes: { secure: true, sameSite: "lax" } },
        // biome-ignore lint/suspicious/noExplicitAny: BetterAuthOptions shape is opaque here.
      } as any,
      {
        plugins: [userPlugin],
        advanced: { defaultCookieAttributes: { sameSite: "strict" } },
      },
    );
    // biome-ignore lint/suspicious/noExplicitAny: access to dynamic option keys.
    const out = merged as any;
    expect(out.plugins).toEqual([facadePlugin, userPlugin]);
    // Shallow-merge replaces the whole defaultCookieAttributes object with the override —
    // this is fine because the facade computes secure/sameSite up front, then hands
    // both to advanced.defaultCookieAttributes, then the user override replaces the
    // entire block. (Deep-merge would surprise users who expect set-semantics.)
    expect(out.advanced.defaultCookieAttributes).toEqual({ sameSite: "strict" });
  });

  test("resolveAuthConfig surfaces authentication overrides through to the resolved shape", () => {
    const out = resolveAuthConfig({
      authentication: { rateLimit: { window: 60, max: 5 } },
    });
    expect(out.authentication).toEqual({ rateLimit: { window: 60, max: 5 } });
  });
});

describe("B8 — voila migrate install-auth command", () => {
  test("appears in --help output", async () => {
    const { run } = await import("../../cli/src/run.ts");
    const out: string[] = [];
    const err: string[] = [];
    await run(["--help"], { out: (l) => out.push(l), err: (l) => err.push(l) });
    expect(out.join("\n")).toMatch(/voila migrate install-auth/);
  });
});
