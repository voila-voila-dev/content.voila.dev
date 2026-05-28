// @voila/content-sql — `NoopDatabaseLive` Layer.
//
// Zero-dependency `Database` Layer that does NOT require a `SqlClient`.
// Every CRUD method short-circuits to `Effect.fail(DatabaseError({ cause:
// "NO_DATABASE" }))`. The point is to give M0 consumers (which don't query
// yet — admin shell, playground canary, integration smokes) a single import
// that satisfies the `database` field of `ContentConfig` without dragging
// `bun:sqlite`, the Cloudflare D1 binding, or `postgres` into the bundle.
//
// Swap to `DatabaseLive.pipe(Layer.provide(<dialect Layer>))` the moment a
// real query lands.

import { Effect, Layer } from "effect";
import { Database, type DatabaseService } from "./database.ts";
import { DatabaseError } from "./error.ts";

/**
 * `Database` Layer that fails every query with `DatabaseError({ cause:
 * "NO_DATABASE" })`. Requires nothing — safe to bundle anywhere.
 */
export const NoopDatabaseLive: Layer.Layer<DatabaseService> = Layer.succeed(Database, {
  list: () => Effect.fail(new DatabaseError({ cause: "NO_DATABASE" })),
  get: () => Effect.fail(new DatabaseError({ cause: "NO_DATABASE" })),
  insert: () => Effect.fail(new DatabaseError({ cause: "NO_DATABASE" })),
  update: () => Effect.fail(new DatabaseError({ cause: "NO_DATABASE" })),
  softDelete: () => Effect.fail(new DatabaseError({ cause: "NO_DATABASE" })),
  restore: () => Effect.fail(new DatabaseError({ cause: "NO_DATABASE" })),
});
