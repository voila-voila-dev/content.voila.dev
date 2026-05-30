// Real HTTP round-trip through the mount. `toVoilaRpcHttpApp` is served on a
// loopback `Bun.serve`, and a genuine `RpcClient` over `FetchHttpClient` reads
// through it — exercising the actual JSON serialization + HTTP framing the
// in-memory `RpcTest` transport skips. Uses a shared file-backed SQLite so the
// seeding connection and the served app see the same data.

import { describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { FetchHttpClient, HttpApp } from "@effect/platform";
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
import { toVoilaRpcHttpApp, VOILA_RPC_PATH } from "./mount";
import { makeVoilaRpc } from "./rpc";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const group = makeVoilaRpc(config);
const dbFile = `${tmpdir()}/voila-rpc-http-${Date.now()}.db`;

describe("voilaRpc — real HTTP mount round-trip", () => {
  it("serves toVoilaRpcHttpApp over HTTP; an RpcClient reads through real JSON framing", async () => {
    // Seed a shared file-backed DB on its own connection.
    const statements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          for (const statement of statements) yield* sql.unsafe(statement);
          yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
            "p1",
            "Hello",
            7,
          ]);
        }).pipe(Effect.provide(SqliteLive({ url: dbFile }))),
      ),
    );

    // Build the app and keep its DB connection alive in a persistent scope.
    const scope = await Effect.runPromise(Scope.make());
    const database = makeDatabaseLayer(config).pipe(Layer.provide(SqliteLive({ url: dbFile })));
    const app = await Effect.runPromise(
      toVoilaRpcHttpApp(config, { database }).pipe(Effect.provideService(Scope.Scope, scope)),
    );
    const webHandler = HttpApp.toWebHandler(app);
    const server = Bun.serve({ port: 0, fetch: (request) => webHandler(request) });

    try {
      const clientLayer = RpcClient.layerProtocolHttp({
        url: `http://localhost:${server.port}${VOILA_RPC_PATH}`,
      }).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(RpcSerialization.layerJson));

      const found = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(group);
          return yield* client.posts.find({ id: "p1" });
        }).pipe(Effect.scoped, Effect.provide(clientLayer)),
      );
      expect(found).toMatchObject({ id: "p1", title: "Hello", views: 7 });

      // The typed error envelope survives the HTTP round-trip too.
      const missing = await Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(group);
          return yield* client.posts.find({ id: "absent" }).pipe(Effect.either);
        }).pipe(Effect.scoped, Effect.provide(clientLayer)),
      );
      expect(missing._tag).toBe("Left");
      if (missing._tag === "Left") expect(missing.left._tag).toBe("NotFound");
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
