// Cross-transport parity: the parallel REST `HttpApi` and the `@effect/rpc` group
// are served over the same file-backed SQLite (two loopback `Bun.serve`s), then
// each read procedure is exercised on both and asserted equal — proving the
// shared read core keeps the two transports in lock-step. Also asserts the error
// envelope shape (status + body) and that the OpenAPI export round-trips.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { FetchHttpClient, HttpApp } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Cause, Effect, Exit, Layer, Option, Schema, Scope } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { collectionDocumentSchema } from "./document";
import { toErrorEnvelope } from "./envelope";
import type { NotFound } from "./errors";
import { toVoilaHttpApiWebHandler, voilaOpenApi } from "./httpapi";
import { toVoilaRpcHttpApp, VOILA_RPC_PATH } from "./mount";
import { makeVoilaRpc } from "./rpc";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const group = makeVoilaRpc(config);
const clientEffect = RpcClient.make(group);
type VoilaRpcClient = Effect.Effect.Success<typeof clientEffect>;

interface PostDoc {
  readonly id: string;
  readonly title: string;
  readonly views: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}
const docSchema = collectionDocumentSchema(posts) as unknown as Schema.Schema<PostDoc>;
const decodeDoc = Schema.decodeUnknownSync(docSchema);

const dbFile = `${tmpdir()}/voila-httpapi-parity-${Date.now()}.db`;

let rpcServer: ReturnType<typeof Bun.serve>;
let restServer: ReturnType<typeof Bun.serve>;
let rpcScope: Scope.CloseableScope;
let restDispose: () => Promise<void>;

beforeAll(async () => {
  const statements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const sql = yield* SqlClient;
        for (const statement of statements) yield* sql.unsafe(statement);
        for (const [id, title, views] of [
          ["p1", "First", 10],
          ["p2", "Second", 20],
        ] as const) {
          yield* sql.unsafe("INSERT INTO posts (id, title, views) VALUES (?, ?, ?)", [
            id,
            title,
            views,
          ]);
        }
      }).pipe(Effect.provide(SqliteLive({ url: dbFile }))),
    ),
  );

  const database = makeDatabaseLayer(config).pipe(Layer.provide(SqliteLive({ url: dbFile })));

  // RPC app on its own long-lived scope.
  rpcScope = await Effect.runPromise(Scope.make());
  const rpcApp = await Effect.runPromise(
    toVoilaRpcHttpApp(config, { database }).pipe(Effect.provideService(Scope.Scope, rpcScope)),
  );
  const rpcHandler = HttpApp.toWebHandler(rpcApp);
  rpcServer = Bun.serve({ port: 0, fetch: (request) => rpcHandler(request) });

  // REST app via the HttpApi web handler.
  const rest = toVoilaHttpApiWebHandler(config, { database });
  restDispose = rest.dispose;
  restServer = Bun.serve({ port: 0, fetch: (request) => rest.handler(request) });
});

afterAll(async () => {
  rpcServer.stop(true);
  restServer.stop(true);
  await restDispose();
  await Effect.runPromise(Scope.close(rpcScope, Exit.void));
  try {
    unlinkSync(dbFile);
  } catch {
    // best-effort cleanup
  }
});

const restUrl = (path: string) => `http://localhost:${restServer.port}${path}`;

// Run a function against the HTTP-served, fully-typed RPC client.
const runRpc = <A, E>(
  use: (client: VoilaRpcClient) => Effect.Effect<A, E>,
): Promise<Exit.Exit<A, E>> => {
  const clientLayer = RpcClient.layerProtocolHttp({
    url: `http://localhost:${rpcServer.port}${VOILA_RPC_PATH}`,
  }).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(RpcSerialization.layerJson));
  return Effect.runPromiseExit(
    Effect.gen(function* () {
      const client = yield* clientEffect;
      return yield* use(client);
    }).pipe(Effect.scoped, Effect.provide(clientLayer)),
  );
};

const orThrow = <A, E>(exit: Exit.Exit<A, E>, what: string): A => {
  if (Exit.isSuccess(exit)) return exit.value;
  throw new Error(`${what} failed: ${Cause.pretty(exit.cause)}`);
};

describe("HttpApi ↔ RPC read parity", () => {
  it("list returns the same documents on both transports", async () => {
    const rpcPage = orThrow(await runRpc((c) => c.posts.list({ limit: 10 })), "rpc list");

    const res = await fetch(restUrl("/posts?limit=10"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { documents: unknown[]; nextCursor: string | null };
    // REST sends the *encoded* document (dates as epoch-ms); decoding it yields
    // the same shape the RPC client already returns decoded.
    const restDocs = body.documents.map((d) => decodeDoc(d));
    expect(restDocs).toEqual(rpcPage.documents as unknown as PostDoc[]);
    expect(restDocs.map((d) => d.id)).toEqual(["p2", "p1"]); // id-desc default
  });

  it("find returns the same document on both transports", async () => {
    const rpcDoc = orThrow(await runRpc((c) => c.posts.find({ id: "p1" })), "rpc find");

    const res = await fetch(restUrl("/posts/p1"));
    expect(res.status).toBe(200);
    const restDoc = decodeDoc(await res.json());
    expect(restDoc).toEqual(rpcDoc);
    expect(restDoc.title).toBe("First");
  });

  it("findOne returns the matching document (nullable) on both transports", async () => {
    const res = await fetch(restUrl("/posts/find-one?field=title&value=Second"));
    expect(res.status).toBe(200);
    const restDoc = decodeDoc(await res.json());
    expect(restDoc.id).toBe("p2");

    const miss = await fetch(restUrl("/posts/find-one?field=title&value=nope"));
    expect(miss.status).toBe(200);
    expect(await miss.json()).toBeNull();
  });

  it("find on a missing id yields the 404 envelope matching toErrorEnvelope", async () => {
    const res = await fetch(restUrl("/posts/absent"));
    expect(res.status).toBe(404);
    const body = await res.json();

    const exit = await runRpc((c) => c.posts.find({ id: "absent" }));
    const rpcError = Exit.isFailure(exit)
      ? Option.getOrNull(Cause.failureOption(exit.cause))
      : null;
    expect(rpcError?._tag).toBe("NotFound");
    if (rpcError) expect(body).toEqual(toErrorEnvelope(rpcError as NotFound));
  });
});

describe("OpenAPI export", () => {
  it("describes every read path and round-trips through JSON", () => {
    const spec = voilaOpenApi(config) as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths).sort()).toEqual(
      ["/posts", "/posts/find-one", "/posts/{id}"].sort(),
    );
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });
});
