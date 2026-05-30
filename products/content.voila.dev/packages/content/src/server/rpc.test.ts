// Integration: the read procedures against real SQLite via an in-memory RPC
// transport (`RpcTest`). The client is the *typed* nested client derived from the
// config-typed group — so this file also proves the types flow end to end:
// `client.posts.find({ id })` is `Effect<Post, NotFound | InternalError>`, and the
// explicit annotations below fail `tsc` if a field is mistyped.

import { describe, expect, it } from "bun:test";
import { RpcTest } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Either, Layer } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { makeVoilaRpcHandlers } from "./handlers";
import { makeVoilaRpc } from "./rpc";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string(),
    views: fields.number(),
  },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const schemaStatements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));

// ids are lexicographically ordered (ULIDs sort this way), so id-desc = newest first.
const seedRows = [
  { id: "p1", title: "First", slug: "first", views: 10 },
  { id: "p2", title: "Second", slug: "second", views: 20 },
  { id: "p3", title: "Third", slug: "third", views: 30 },
  { id: "p4", title: "Gone", slug: "gone", views: 0, deletedAt: 1_700_000_000_000 },
] as const;

const bootstrap = Effect.gen(function* () {
  const sql = yield* SqlClient;
  for (const statement of schemaStatements) yield* sql.unsafe(statement);
  for (const row of seedRows) {
    yield* sql.unsafe(
      "INSERT INTO posts (id, title, slug, views, deleted_at) VALUES (?, ?, ?, ?, ?)",
      [row.id, row.title, row.slug, row.views, "deletedAt" in row ? row.deletedAt : null],
    );
  }
});

const group = makeVoilaRpc(config);

// One in-memory connection shared by bootstrap (SqlClient), the Database, and
// the RPC handlers. `provideMerge` keeps SqlClient + Database in the output.
const layer = makeVoilaRpcHandlers(config).pipe(
  Layer.provideMerge(
    makeDatabaseLayer(config).pipe(Layer.provideMerge(SqliteLive({ url: ":memory:" }))),
  ),
);

const clientEffect = RpcTest.makeClient(group);

const run = <A, E>(
  body: (client: Effect.Effect.Success<typeof clientEffect>) => Effect.Effect<A, E, never>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.provide(bootstrap.pipe(Effect.zipRight(Effect.flatMap(clientEffect, body))), layer),
    ),
  );

describe("voilaRpc — posts.list", () => {
  it("returns live rows newest-first with a null cursor on the last page", async () => {
    const page = await run((client) => client.posts.list({}));
    expect(page.documents.map((d) => d.id)).toEqual(["p3", "p2", "p1"]);
    expect(page.nextCursor).toBeNull();
    // typed: documents carry the real field shape
    const first = page.documents[0];
    if (first === undefined) throw new Error("expected a row");
    const title: string = first.title;
    const views: number = first.views;
    expect(title).toBe("Third");
    expect(views).toBe(30);
  });

  it("paginates via the opaque cursor", async () => {
    const result = await run((client) =>
      Effect.gen(function* () {
        const first = yield* client.posts.list({ limit: 2 });
        expect(first.documents.map((d) => d.id)).toEqual(["p3", "p2"]);
        expect(first.nextCursor).not.toBeNull();
        const second = yield* client.posts.list({
          limit: 2,
          cursor: first.nextCursor ?? undefined,
        });
        return second.documents.map((d) => d.id);
      }),
    );
    expect(result).toEqual(["p1"]);
  });

  it("maps an unknown orderBy to a typed BadRequest", async () => {
    const result = await run((client) =>
      client.posts.list({ orderBy: "nope" }).pipe(Effect.either),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("BadRequest");
  });
});

describe("voilaRpc — posts.find", () => {
  it("returns the typed document for a live id", async () => {
    const doc = await run((client) => client.posts.find({ id: "p2" }));
    expect(doc).toMatchObject({ id: "p2", title: "Second", views: 20 });
    const title: string = doc.title;
    expect(title).toBe("Second");
  });

  it("fails with a typed NotFound for a missing id", async () => {
    const result = await run((client) => client.posts.find({ id: "absent" }).pipe(Effect.either));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("NotFound");
      if (result.left._tag === "NotFound") {
        expect(result.left.collection).toBe("posts");
        expect(result.left.id).toBe("absent");
      }
    }
  });

  it("fails with NotFound for a soft-deleted id", async () => {
    const result = await run((client) => client.posts.find({ id: "p4" }).pipe(Effect.either));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("NotFound");
  });
});

describe("voilaRpc — posts.findOne", () => {
  it("returns the first row matching a field/value", async () => {
    const doc = await run((client) => client.posts.findOne({ field: "slug", value: "second" }));
    expect(doc).toMatchObject({ id: "p2", slug: "second" });
  });

  it("returns null when nothing matches", async () => {
    const doc = await run((client) => client.posts.findOne({ field: "slug", value: "nope" }));
    expect(doc).toBeNull();
  });

  it("maps an unknown field to a typed BadRequest", async () => {
    const result = await run((client) =>
      client.posts.findOne({ field: "nope", value: "x" }).pipe(Effect.either),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("BadRequest");
  });
});
