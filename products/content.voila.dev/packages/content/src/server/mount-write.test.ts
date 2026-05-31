// Real HTTP round-trip for a mutation with CSRF enforced. `toVoilaRpcHttpApp` is
// mounted with a `secret`, so every write requires the double-submit token. A client
// that injects the matching `voila_csrf` cookie + `x-voila-csrf` header succeeds; one
// without is rejected with the typed `Forbidden` error over real JSON framing.

import { describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { FetchHttpClient, HttpApp, HttpClient, HttpClientRequest } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Exit, Layer, Scope } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { CSRF_COOKIE, CSRF_HEADER, mintCsrfToken } from "./csrf";
import { toVoilaRpcHttpApp, VOILA_RPC_PATH } from "./mount";
import { makeVoilaRpc } from "./rpc";

const SECRET = "mount-write-test-secret-32-chars-xx";
const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const group = makeVoilaRpc(config);
const dbFile = `${tmpdir()}/voila-write-http-${Date.now()}.db`;

// A `FetchHttpClient` that attaches the CSRF cookie + header to every request.
const withCsrf = (token: string): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (client) =>
      HttpClient.mapRequest(client, (request) =>
        request.pipe(
          HttpClientRequest.setHeader("cookie", `${CSRF_COOKIE}=${token}`),
          HttpClientRequest.setHeader(CSRF_HEADER, token),
        ),
      ),
    ),
  ).pipe(Layer.provide(FetchHttpClient.layer));

describe("voilaRpc — write over HTTP with CSRF", () => {
  it("rejects a write without the CSRF token, accepts one with it", async () => {
    const statements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          for (const statement of statements) yield* sql.unsafe(statement);
        }).pipe(Effect.provide(SqliteLive({ url: dbFile }))),
      ),
    );

    const scope = await Effect.runPromise(Scope.make());
    const database = makeDatabaseLayer(config).pipe(Layer.provide(SqliteLive({ url: dbFile })));
    const app = await Effect.runPromise(
      toVoilaRpcHttpApp(config, { database, secret: SECRET }).pipe(
        Effect.provideService(Scope.Scope, scope),
      ),
    );
    const webHandler = HttpApp.toWebHandler(app);
    const server = Bun.serve({ port: 0, fetch: (request) => webHandler(request) });
    const url = `http://localhost:${server.port}${VOILA_RPC_PATH}`;

    try {
      // No CSRF token → Forbidden.
      const plainLayer = RpcClient.layerProtocolHttp({ url }).pipe(
        Layer.provide(FetchHttpClient.layer),
        Layer.provide(RpcSerialization.layerJson),
      );
      const denied = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(group);
          return yield* client.posts
            .create({ data: { title: "Nope", views: 0 } })
            .pipe(Effect.either);
        }).pipe(Effect.scoped, Effect.provide(plainLayer)),
      );
      expect(denied._tag).toBe("Left");
      if (denied._tag === "Left") expect(denied.left._tag).toBe("Forbidden");

      // Matching cookie + header → success.
      const token = await mintCsrfToken(SECRET);
      const csrfLayer = RpcClient.layerProtocolHttp({ url }).pipe(
        Layer.provide(withCsrf(token)),
        Layer.provide(RpcSerialization.layerJson),
      );
      const created = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(group);
          return yield* client.posts.create({ data: { title: "Allowed", views: 5 } });
        }).pipe(Effect.scoped, Effect.provide(csrfLayer)),
      );
      expect(created).toMatchObject({ title: "Allowed", views: 5 });
      expect(typeof created.id).toBe("string");
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
