// Real HTTP enforcement: the mount served *with* `auth` rejects an
// unauthenticated RPC call with the typed `Unauthorized` error and serves a
// request carrying a valid session cookie. The session is minted through the
// real magic-link flow (sign-in → verify) on the same file-backed DB, so the
// served app's Better Auth instance validates the cookie the client sends. The
// client is built from the *authed* group so it can decode the middleware's
// `Unauthorized` failure off the wire.

import { describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { FetchHttpClient, HttpApp, HttpClient, HttpClientRequest } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Exit, Layer, Scope } from "effect";
import { Auth } from "../auth/auth";
import { BetterAuthLive } from "../auth/better-auth";
import { Mailer } from "../auth/mailers/mailer";
import { SessionMiddleware } from "../auth/middleware";
import { authTableStatements } from "../auth/schema";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { toVoilaRpcHttpApp, VOILA_RPC_PATH } from "./mount";
import { makeVoilaRpc } from "./rpc";

const SECRET = "test-secret-at-least-32-chars-long-xx";

const required = <T>(value: T | null | undefined, what: string): T => {
  if (value === null || value === undefined) throw new Error(`expected ${what}`);
  return value;
};

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
// The client must share the middleware so it can decode the `Unauthorized` failure.
const authedGroup = makeVoilaRpc(config).middleware(SessionMiddleware);
const dbFile = `${tmpdir()}/voila-rpc-auth-${Date.now()}.db`;

const sqlite = SqliteLive({ url: dbFile });

// Sign in + verify through the real flow; return the issued session cookie.
const mintSessionCookie = (): Promise<string> => {
  const links: string[] = [];
  const captureMailer = Layer.succeed(Mailer, {
    id: "capture",
    send: (m) => Effect.sync(() => void links.push(m.url)),
  });
  const authLayer = BetterAuthLive({ baseUrl: "http://localhost" }, { secret: SECRET }).pipe(
    Layer.provide(captureMailer),
    Layer.provide(sqlite),
  );
  return Effect.runPromise(
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
        const verify = yield* auth.handler(
          new Request(required(links[0], "magic-link URL"), { redirect: "manual" }),
        );
        return required(verify.headers.get("set-cookie")?.split(";")[0], "session cookie");
      }).pipe(Effect.provide(authLayer)),
    ),
  );
};

// A client transport that attaches the given cookie header to every request.
const clientLayer = (url: string, cookie?: string) => {
  const fetch = cookie
    ? Layer.effect(
        HttpClient.HttpClient,
        Effect.map(
          HttpClient.HttpClient,
          HttpClient.mapRequest(HttpClientRequest.setHeader("cookie", cookie)),
        ),
      ).pipe(Layer.provide(FetchHttpClient.layer))
    : FetchHttpClient.layer;
  return RpcClient.layerProtocolHttp({ url }).pipe(
    Layer.provide(fetch),
    Layer.provide(RpcSerialization.layerJson),
  );
};

describe("voilaRpc mount — session enforcement over HTTP", () => {
  it("rejects unauthenticated reads and serves authenticated ones", async () => {
    // Seed posts + auth tables on a shared file DB, then mint a session cookie.
    const ddl = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
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
    const cookie = await mintSessionCookie();

    // Serve the authed mount; keep the connection alive in a persistent scope.
    const scope = await Effect.runPromise(Scope.make());
    const database = makeDatabaseLayer(config).pipe(Layer.provide(sqlite));
    const auth = BetterAuthLive({ baseUrl: "http://localhost" }, { secret: SECRET }).pipe(
      Layer.provide(Layer.succeed(Mailer, { id: "noop", send: () => Effect.void })),
      Layer.provide(sqlite),
    );
    const app = await Effect.runPromise(
      toVoilaRpcHttpApp(config, { database, auth }).pipe(Effect.provideService(Scope.Scope, scope)),
    );
    const webHandler = HttpApp.toWebHandler(app);
    const server = Bun.serve({ port: 0, fetch: (request) => webHandler(request) });
    const url = `http://localhost:${server.port}${VOILA_RPC_PATH}`;

    try {
      // No cookie → typed Unauthorized off the wire.
      const denied = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(authedGroup);
          return yield* client.posts.list({}).pipe(Effect.either);
        }).pipe(Effect.scoped, Effect.provide(clientLayer(url))),
      );
      expect(denied._tag).toBe("Left");
      if (denied._tag === "Left") expect(denied.left._tag).toBe("Unauthorized");

      // Valid cookie → the read succeeds.
      const allowed = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(authedGroup);
          return yield* client.posts.list({});
        }).pipe(Effect.scoped, Effect.provide(clientLayer(url, cookie))),
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
