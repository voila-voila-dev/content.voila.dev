// Integration: the write procedures against real SQLite via the in-memory RPC
// transport (`RpcTest`), through the *typed* config-derived client. This proves the
// write types flow end to end — `client.posts.create({ data })` returns the typed
// document — and that validation/conflict/not-found map to the right typed errors.

import { describe, expect, it } from "bun:test";
import { RpcTest } from "@effect/rpc";
import { SqlClient } from "@effect/sql/SqlClient";
import { Cause, Effect, Exit, Layer } from "effect";
import { defineConfig } from "../config/config";
import { defineCollection } from "../config/schema/collection";
import * as fields from "../config/schema/fields";
import { SqliteLive } from "../sql/client/sqlite";
import { makeDatabaseLayer } from "../sql/database/database";
import { deriveSchema } from "../sql/ddl/derive-schema";
import { generateDDL } from "../sql/ddl/generate-ddl";
import { splitStatements } from "../sql/migrator/loader";
import { CsrfMiddlewareTestLive } from "./csrf";
import { makeVoilaRpcHandlers } from "./handlers";
import { makeVoilaRpc } from "./rpc";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string({ unique: true }),
    views: fields.number(),
    published: fields.boolean(),
  },
});
const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });
const schemaStatements = splitStatements(generateDDL(deriveSchema(config), "sqlite"));

const bootstrap = Effect.gen(function* () {
  const sql = yield* SqlClient;
  for (const statement of schemaStatements) yield* sql.unsafe(statement);
});

const group = makeVoilaRpc(config);
const layer = makeVoilaRpcHandlers(config).pipe(
  Layer.provideMerge(
    makeDatabaseLayer(config).pipe(Layer.provideMerge(SqliteLive({ url: ":memory:" }))),
  ),
  Layer.merge(CsrfMiddlewareTestLive),
);
const clientEffect = RpcTest.makeClient(group);

// Each spec runs against a fresh bootstrapped in-memory DB.
const run = <A, E>(
  body: (client: Effect.Effect.Success<typeof clientEffect>) => Effect.Effect<A, E, never>,
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.provide(bootstrap.pipe(Effect.zipRight(Effect.flatMap(clientEffect, body))), layer),
    ),
  );

// Run a write that is expected to fail, returning the typed error.
const runError = <A, E>(
  body: (client: Effect.Effect.Success<typeof clientEffect>) => Effect.Effect<A, E, never>,
): Promise<E> => run((client) => body(client).pipe(Effect.flip));

describe("voilaRpc — writes", () => {
  it("create fills system columns and returns the typed document", async () => {
    const doc = await run((client) =>
      client.posts.create({ data: { title: "Hello", slug: "hello", views: 3, published: true } }),
    );
    expect(typeof doc.id).toBe("string");
    const title: string = doc.title; // typed inference
    const published: boolean = doc.published;
    expect(title).toBe("Hello");
    expect(published).toBe(true);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.deletedAt).toBeNull();
  });

  it("create rejects invalid input with a VALIDATION error carrying field messages", async () => {
    const error = await runError((client) =>
      // `title` is required, `views` must be a number.
      client.posts.create({ data: { slug: "x", views: "nope", published: false } }),
    );
    expect(error._tag).toBe("ValidationError");
    if (error._tag !== "ValidationError") throw new Error("expected ValidationError");
    expect(error.collection).toBe("posts");
    expect(Object.keys(error.fields)).toContain("title");
    expect(Object.keys(error.fields)).toContain("views");
  });

  it("a duplicate unique field fails with CONFLICT naming the field", async () => {
    const error = await runError((client) =>
      Effect.gen(function* () {
        yield* client.posts.create({
          data: { title: "A", slug: "dupe", views: 0, published: false },
        });
        return yield* client.posts.create({
          data: { title: "B", slug: "dupe", views: 0, published: false },
        });
      }),
    );
    expect(error._tag).toBe("ConflictError");
    if (error._tag !== "ConflictError") throw new Error("expected ConflictError");
    expect(error.field).toBe("slug");
  });

  it("update patches supplied fields and bumps updatedAt; missing → NotFound", async () => {
    const updated = await run((client) =>
      Effect.gen(function* () {
        const created = yield* client.posts.create({
          data: { title: "First", slug: "first", views: 1, published: false },
        });
        return yield* client.posts.update({ id: created.id, data: { title: "Edited" } });
      }),
    );
    expect(updated.title).toBe("Edited");
    expect(updated.slug).toBe("first"); // untouched

    const missing = await runError((client) =>
      client.posts.update({ id: "ghost", data: { title: "x" } }),
    );
    expect(missing._tag).toBe("NotFound");
  });

  it("soft delete hides the row; restore brings it back; hard delete purges", async () => {
    const result = await run((client) =>
      Effect.gen(function* () {
        const created = yield* client.posts.create({
          data: { title: "Doomed", slug: "doomed", views: 0, published: false },
        });
        const del = yield* client.posts.delete({ id: created.id });
        const afterDelete = yield* client.posts.findOne({ field: "slug", value: "doomed" });
        const restored = yield* client.posts.restore({ id: created.id });
        const afterRestore = yield* client.posts.findOne({ field: "slug", value: "doomed" });
        yield* client.posts.delete({ id: created.id, hard: true });
        return { del, afterDelete, restored, afterRestore, id: created.id };
      }),
    );
    expect(result.del).toEqual({ id: result.id, hard: false });
    expect(result.afterDelete).toBeNull();
    expect(result.restored.title).toBe("Doomed");
    expect(result.afterRestore).not.toBeNull();

    // After a hard delete the row is gone for good — restore reports NotFound.
    const gone = await runError((client) =>
      Effect.gen(function* () {
        const created = yield* client.posts.create({
          data: { title: "X", slug: "x", views: 0, published: false },
        });
        yield* client.posts.delete({ id: created.id, hard: true });
        return yield* client.posts.restore({ id: created.id });
      }),
    );
    expect(gone._tag).toBe("NotFound");
  });

  it("delete on a missing id is NotFound", async () => {
    const exit = await Effect.runPromise(
      Effect.scoped(
        Effect.provide(
          bootstrap.pipe(
            Effect.zipRight(
              Effect.flatMap(clientEffect, (client) =>
                Effect.exit(client.posts.delete({ id: "nope" })),
              ),
            ),
          ),
          layer,
        ),
      ),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag === "Some" && error.value._tag).toBe("NotFound");
    }
  });
});
