// @voila/content-sql — `Database` Service.
// Design: products/content.voila.dev/docs/pivot/packages/content-sql.md
//
// M0: typed surface only. The CRUD methods compile and resolve via
// `DatabaseLive`, but each method fails with `DatabaseError({ cause: "M1" })`
// at runtime. Real query implementations land in M1.
import { SqlClient } from "@effect/sql";
import { Context, Effect, Layer } from "effect";
import { DatabaseError } from "./error.ts";

/**
 * Opaque row type — a record keyed by column name with unknown values.
 * Real per-collection row types are materialised by `@voila/content` in M1
 * from `effect/Schema` decoders; this package stays schema-agnostic.
 */
export type Row = Readonly<Record<string, unknown>>;

/**
 * Options for `Database.list`. Cursor pagination is the only supported mode.
 * Concrete cursor encoding is defined by the resolver (M1).
 */
export interface ListOpts {
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly orderBy?: string | undefined;
}

/**
 * Shape returned by `Database.list`. `nextCursor` is `null` when the page is
 * the last page.
 */
export interface ListResult {
  readonly rows: ReadonlyArray<Row>;
  readonly nextCursor: string | null;
}

/**
 * The query interface every resolver in `@voila/content` depends on. The
 * concrete `Layer` (`DatabaseLive`) requires an `@effect/sql` `SqlClient` —
 * dialect packages (`/d1`, `/pg`, `/sqlite`) provide that `Layer`.
 */
export interface DatabaseService {
  readonly list: (collection: string, opts: ListOpts) => Effect.Effect<ListResult, DatabaseError>;
  readonly get: (collection: string, id: string) => Effect.Effect<Row | null, DatabaseError>;
  readonly insert: (collection: string, row: Row) => Effect.Effect<Row, DatabaseError>;
  readonly update: (
    collection: string,
    id: string,
    patch: Partial<Row>,
  ) => Effect.Effect<Row, DatabaseError>;
  readonly softDelete: (collection: string, id: string) => Effect.Effect<void, DatabaseError>;
  readonly restore: (collection: string, id: string) => Effect.Effect<void, DatabaseError>;
}

/**
 * Service tag for `Database`. Consumers `yield* Database` inside an
 * `Effect.gen` to obtain a `DatabaseService`.
 */
export const Database: Context.Tag<DatabaseService, DatabaseService> = Context.GenericTag<
  DatabaseService,
  DatabaseService
>("@voila/content-sql/Database");

/**
 * Default `Database` `Layer`. M0: returns a service whose every method fails
 * with `DatabaseError({ cause: "M1" })`. The point in M0 is that the
 * `Layer.provide(<dialect Layer>)` wiring resolves and a `ManagedRuntime`
 * can be built — real CRUD lands in M1 backed by the `SqlClient` from the
 * dialect.
 */
export const DatabaseLive: Layer.Layer<DatabaseService, never, SqlClient.SqlClient> = Layer.effect(
  Database,
  Effect.gen(function* () {
    // Resolve the seam so misconfigured graphs (no dialect Layer provided)
    // surface as a compile-time / runtime error here rather than at the
    // first query. We don't use it yet — M1 will compile statements.
    yield* SqlClient.SqlClient;
    // `Effect.fail` has a `never` success channel, which is the bottom type
    // and assigns to every concrete success type below — no casts required.
    const todo: Effect.Effect<never, DatabaseError> = Effect.fail(
      new DatabaseError({ cause: "M1" }),
    );
    return {
      list: () => todo,
      get: () => todo,
      insert: () => todo,
      update: () => todo,
      softDelete: () => todo,
      restore: () => todo,
    };
  }),
);
