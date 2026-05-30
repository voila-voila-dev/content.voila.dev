// Integration: the read procedures against a real Cloudflare D1 binding, served
// in-process by Miniflare (workerd) — no `wrangler dev` spawn, no HTTP flakiness,
// but the same `@effect/sql-d1` D1 driver the worker uses in production. Proves
// `D1Live` resolves the `SqlClient` seam so the *exact* RPC handler stack
// (`makeVoilaRpcHandlers`) reads through D1 identically to SQLite.
//
// Opt-in via `D1=1 bun test` — Miniflare boots a workerd subprocess (~1s), so it
// stays out of the default fast suite.

import { describe, expect, it } from "bun:test";
import { RpcTest } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Either, Layer } from "effect";
import { Miniflare } from "miniflare";
import { defineConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { makeVoilaRpcHandlers } from "../../server/handlers";
import { makeVoilaRpc } from "../../server/rpc";
import { makeDatabaseLayer } from "../database/database";
import { deriveSchema } from "../ddl/derive-schema";
import { generateDDL } from "../ddl/generate-ddl";
import { splitStatements } from "../migrator/loader";
import { type D1Binding, D1Live } from "./d1";

const suite = process.env.D1 === "1" ? describe : describe.skip;

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const group = makeVoilaRpc(config);
const ddl = splitStatements(generateDDL(deriveSchema(config), "sqlite"));

suite("D1Live — read procedures against Miniflare D1", () => {
  it("serves list/find/findOne over a real D1 binding", async () => {
    const mf = new Miniflare({
      modules: true,
      script: "export default { fetch() { return new Response('ok'); } };",
      d1Databases: { DATABASE: ":memory:" },
    });
    try {
      const binding = (await mf.getD1Database("DATABASE")) as unknown as D1Binding;

      // The full handler stack over D1: SqlClient (D1) → Database → RPC handlers,
      // read through the in-memory RpcTest transport (same as the SQLite suite).
      const layer = makeVoilaRpcHandlers(config).pipe(
        Layer.provideMerge(makeDatabaseLayer(config).pipe(Layer.provideMerge(D1Live({ binding })))),
      );
      const clientEffect = RpcTest.makeClient(group);

      const result = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const sql = yield* SqlClient;
            for (const statement of ddl) yield* sql.unsafe(statement);
            yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
              "p1",
              "Hello",
              7,
            ]);
            yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
              "p2",
              "World",
              9,
            ]);
            const client = yield* clientEffect;
            const page = yield* client.posts.list({ limit: 10 });
            const found = yield* client.posts.find({ id: "p1" });
            const one = yield* client.posts.findOne({ field: "title", value: "World" });
            const missing = yield* client.posts.find({ id: "absent" }).pipe(Effect.either);
            return { page, found, one, missing };
          }).pipe(Effect.provide(layer)),
        ),
      );

      expect(result.page.documents).toHaveLength(2);
      expect(result.page.documents.map((d) => d.id)).toEqual(["p2", "p1"]); // id-desc
      expect(result.found).toMatchObject({ id: "p1", title: "Hello", views: 7 });
      expect(result.one?.id).toBe("p2");
      expect(Either.isLeft(result.missing)).toBe(true);
      if (Either.isLeft(result.missing)) expect(result.missing.left._tag).toBe("NotFound");
    } finally {
      await mf.dispose();
    }
  });
});
