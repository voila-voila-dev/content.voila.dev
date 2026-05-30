// End-to-end: `createAsyncClient` against a real served `voilaRpc` app (loopback
// Bun.serve + HttpApp.toWebHandler), reading over real HTTP/JSON. Also pins the
// client types — the explicit annotations below fail `tsc` if inference drifts.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { HttpApp } from "@effect/platform";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Exit, Layer, Scope } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { toVoilaRpcHttpApp, VOILA_RPC_PATH } from "../server/mount";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { createAsyncClient } from "./index";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string(), views: fields.number() },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const dbFile = `${tmpdir()}/voila-client-${Date.now()}.db`;

let server: ReturnType<typeof Bun.serve>;
let serverScope: Scope.CloseableScope;
let client: ReturnType<typeof createAsyncClient<typeof config>>;

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

  serverScope = await Effect.runPromise(Scope.make());
  const database = makeDatabaseLayer(config).pipe(Layer.provide(SqliteLive({ url: dbFile })));
  const app = await Effect.runPromise(
    toVoilaRpcHttpApp(config, { database }).pipe(Effect.provideService(Scope.Scope, serverScope)),
  );
  const webHandler = HttpApp.toWebHandler(app);
  server = Bun.serve({ port: 0, fetch: (request) => webHandler(request) });

  client = createAsyncClient(config, {
    url: `http://localhost:${server.port}${VOILA_RPC_PATH}`,
  });
});

afterAll(async () => {
  await client.dispose();
  server.stop(true);
  await Effect.runPromise(Scope.close(serverScope, Exit.void));
  try {
    unlinkSync(dbFile);
  } catch {
    // best-effort cleanup
  }
});

describe("createAsyncClient", () => {
  it("find returns a typed document as a Promise", async () => {
    const doc = await client.posts.find({ id: "p1" });
    // typed: these annotations are the assertion
    const title: string = doc.title;
    const views: number = doc.views;
    expect(title).toBe("First");
    expect(views).toBe(10);
    expect(doc.id).toBe("p1");
  });

  it("list paginates and returns a typed page", async () => {
    const page = await client.posts.list({ limit: 1 });
    expect(page.documents).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    const first = page.documents[0];
    if (first === undefined) throw new Error("expected a row");
    const title: string = first.title;
    expect(title).toBe("Second"); // id-desc: newest first
  });

  it("findOne returns a nullable typed document", async () => {
    const hit = await client.posts.findOne({ field: "title", value: "Second" });
    expect(hit?.id).toBe("p2");
    const miss = await client.posts.findOne({ field: "title", value: "nope" });
    expect(miss).toBeNull();
  });

  it("rejects with the typed error on a missing find", async () => {
    const err = await client.posts.find({ id: "absent" }).then(
      () => null,
      (e) => e,
    );
    expect(err?._tag).toBe("NotFound");
  });
});
