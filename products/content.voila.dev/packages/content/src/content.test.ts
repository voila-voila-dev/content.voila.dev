// `defineContent` composes the runtime layer graph from a single config, and
// `makeHandler` mounts it. This proves the umbrella wiring end to end: the
// console mailer is resolved from `env`, `BetterAuthLive` is built from the
// `auth` block + `secret`, and the `Database` + `Auth` layers share one
// connection — a magic-link session minted through `content.auth` is then
// accepted by the `makeHandler` app while an unauthenticated read is rejected.

import { describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { FetchHttpClient, HttpApp, HttpClient, HttpClientRequest } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Exit, Layer, Scope } from "effect";
import { Auth } from "./auth/auth";
import { SessionMiddleware } from "./auth/middleware";
import { authTableStatements } from "./auth/schema";
import { defineCollection } from "./config/schema/collection";
import * as fields from "./config/schema/fields";
import { defineContent } from "./content";
import { makeHandler } from "./server/handler";
import { VOILA_RPC_PATH } from "./server/mount";
import { makeVoilaRpc } from "./server/rpc";
import { SqliteLive } from "./sql/client/sqlite";
import { deriveSchema } from "./sql/ddl/derive-schema";
import { generateDDL } from "./sql/ddl/generate-ddl";
import { splitStatements } from "./sql/migrator/loader";

const SECRET = "test-secret-at-least-32-chars-long-xx";

const required = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`expected ${what}`);
  return value;
};

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const branding = { name: "Test" } as const;
const dbFile = `${tmpdir()}/voila-content-${Date.now()}.db`;
const sqlite = SqliteLive({ url: dbFile });

const content = defineContent({
  branding,
  collections: { posts },
  database: sqlite,
  auth: { baseUrl: "http://localhost" },
  secret: SECRET,
  env: {},
});
const authedGroup = makeVoilaRpc(content.config).middleware(SessionMiddleware);

describe("defineContent", () => {
  it("normalizes the config and only builds an auth layer when auth is set", () => {
    expect(content.config.collections.posts.slug).toBe("posts");
    expect(content.auth).toBeDefined();

    const noAuth = defineContent({ branding, collections: { posts }, database: sqlite });
    expect(noAuth.auth).toBeUndefined();
  });

  it("throws when auth is configured without a secret", () => {
    expect(() =>
      defineContent({ branding, collections: { posts }, database: sqlite, auth: {} }),
    ).toThrow(/secret/);
  });

  it("wires Database + Auth on one connection; makeHandler enforces the session", async () => {
    // Seed posts + auth tables on the shared file DB.
    const ddl = splitStatements(generateDDL(deriveSchema(content.config), "sqlite"));
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          for (const statement of [...ddl, ...authTableStatements]) yield* sql.unsafe(statement);
          yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
            "p1",
            "Hello",
            7,
          ]);
        }).pipe(Effect.provide(sqlite)),
      ),
    );

    // Mint a session through `content.auth`; the console mailer logs the link,
    // so spy on console.log to recover it (proves env → console resolution).
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => void lines.push(args.join(" "));
    let cookie: string;
    try {
      cookie = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const auth = yield* Auth;
            yield* auth.handler(
              new Request("http://localhost/admin/api/auth/sign-in/magic-link", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email: "admin@acme.com", callbackURL: "/admin" }),
              }),
            );
            const link = required(
              lines.join("\n").match(/https?:\/\/\S+/)?.[0],
              "logged magic-link URL",
            );
            const verify = yield* auth.handler(new Request(link, { redirect: "manual" }));
            return required(verify.headers.get("set-cookie")?.split(";")[0], "session cookie");
          }).pipe(Effect.provide(required(content.auth, "auth layer"))),
        ),
      );
    } finally {
      console.log = originalLog;
    }

    // Serve via makeHandler and exercise both the denied and allowed paths.
    const scope = await Effect.runPromise(Scope.make());
    const app = await Effect.runPromise(
      makeHandler(content).pipe(Effect.provideService(Scope.Scope, scope)),
    );
    const webHandler = HttpApp.toWebHandler(app);
    const server = Bun.serve({ port: 0, fetch: (request) => webHandler(request) });
    const url = `http://localhost:${server.port}${VOILA_RPC_PATH}`;

    const clientLayer = (withCookie?: string) => {
      const fetch = withCookie
        ? Layer.effect(
            HttpClient.HttpClient,
            Effect.map(
              HttpClient.HttpClient,
              HttpClient.mapRequest(HttpClientRequest.setHeader("cookie", withCookie)),
            ),
          ).pipe(Layer.provide(FetchHttpClient.layer))
        : FetchHttpClient.layer;
      return RpcClient.layerProtocolHttp({ url }).pipe(
        Layer.provide(fetch),
        Layer.provide(RpcSerialization.layerJson),
      );
    };

    try {
      const denied = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(authedGroup);
          return yield* client.posts.list({}).pipe(Effect.either);
        }).pipe(Effect.scoped, Effect.provide(clientLayer())),
      );
      expect(denied._tag).toBe("Left");
      if (denied._tag === "Left") expect(denied.left._tag).toBe("Unauthorized");

      const allowed = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(authedGroup);
          return yield* client.posts.list({});
        }).pipe(Effect.scoped, Effect.provide(clientLayer(cookie))),
      );
      expect(allowed.documents).toHaveLength(1);
      expect(allowed.documents[0]).toMatchObject({ id: "p1", title: "Hello", views: 7 });
    } finally {
      server.stop(true);
      await Effect.runPromise(Scope.close(scope, Exit.void));
      try {
        unlinkSync(dbFile);
      } catch {
        // best-effort cleanup
      }
    }
  });
});
