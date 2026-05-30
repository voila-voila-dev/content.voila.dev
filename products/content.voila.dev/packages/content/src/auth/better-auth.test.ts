// E2E: the magic-link login flow through `BetterAuthLive` end to end — request a
// link (captured by a stub mailer), follow the verify URL, then resolve the
// session from the issued cookie. Exercises the real Better Auth instance over
// the SqlClient adapter (no mocks below better-auth). Also covers the fail-soft
// `getSession`/`requireSession` contract.

import { describe, expect, it } from "bun:test";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Layer } from "effect";
import { SqliteLive } from "../sql/client/sqlite";
import { Auth, type AuthSession } from "./auth";
import { BetterAuthLive } from "./better-auth";
import { Mailer } from "./mailers/mailer";
import { authTableStatements } from "./schema";

const SECRET = "test-secret-at-least-32-chars-long-xx";

const required = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`expected ${what}`);
  return value;
};

// Build the auth layer with a stub mailer that records magic-link URLs into
// `links`, over a fresh in-memory DB. Returns both so a test can read captures.
const makeHarness = () => {
  const links: string[] = [];
  const mailer = Layer.succeed(Mailer, {
    id: "capture",
    send: (m) => Effect.sync(() => void links.push(m.url)),
  });
  const layer = BetterAuthLive({ baseUrl: "http://localhost" }, { secret: SECRET }).pipe(
    Layer.provide(mailer),
    Layer.provideMerge(SqliteLive({ url: ":memory:" })),
  );
  return { links, layer };
};

const bootstrap = Effect.gen(function* () {
  const sql = yield* SqlClient;
  for (const stmt of authTableStatements) yield* sql.unsafe(stmt);
});

describe("BetterAuthLive — magic-link flow", () => {
  it("signs in, verifies, and resolves the session from the cookie", async () => {
    const { links, layer } = makeHarness();
    const session = await Effect.runPromise(
      Effect.scoped(
        Effect.provide(
          Effect.gen(function* () {
            yield* bootstrap;
            const auth = yield* Auth;

            const signIn = yield* auth.handler(
              new Request("http://localhost/admin/api/auth/sign-in/magic-link", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email: "admin@acme.com", callbackURL: "/admin" }),
              }),
            );
            expect(signIn.status).toBe(200);
            expect(links).toHaveLength(1);

            const link = required(links[0], "magic-link URL");
            const verify = yield* auth.handler(new Request(link, { redirect: "manual" }));
            expect(verify.status).toBe(302);
            const cookie = required(
              verify.headers.get("set-cookie")?.split(";")[0],
              "session cookie",
            );

            return yield* auth.getSession(new Request("http://localhost", { headers: { cookie } }));
          }),
          layer,
        ),
      ),
    );
    expect(session?.email).toBe("admin@acme.com");
    expect(session?.userId).toBeTruthy();
    expect((session as AuthSession).expiresAt).toBeInstanceOf(Date);
  });

  it("getSession returns null and requireSession fails Unauthorized without a cookie", async () => {
    const { layer } = makeHarness();
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.provide(
          Effect.gen(function* () {
            yield* bootstrap;
            const auth = yield* Auth;
            const anon = new Request("http://localhost");
            const none = yield* auth.getSession(anon);
            const exit = yield* Effect.exit(auth.requireSession(anon));
            return { none, failed: exit._tag === "Failure" };
          }),
          layer,
        ),
      ),
    );
    expect(result.none).toBeNull();
    expect(result.failed).toBe(true);
  });

  it("rejects a tampered magic-link token", async () => {
    const { links, layer } = makeHarness();
    const session = await Effect.runPromise(
      Effect.scoped(
        Effect.provide(
          Effect.gen(function* () {
            yield* bootstrap;
            const auth = yield* Auth;
            yield* auth.handler(
              new Request("http://localhost/admin/api/auth/sign-in/magic-link", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email: "admin@acme.com", callbackURL: "/admin" }),
              }),
            );
            const tampered = required(links[0], "magic-link URL").replace(
              /token=[^&]+/,
              "token=not-a-real-token",
            );
            const verify = yield* auth.handler(new Request(tampered, { redirect: "manual" }));
            const cookie = verify.headers.get("set-cookie")?.split(";")[0];
            return yield* auth.getSession(
              new Request("http://localhost", { headers: cookie ? { cookie } : {} }),
            );
          }),
          layer,
        ),
      ),
    );
    expect(session).toBeNull();
  });
});
