// @voila/content-sql — public barrel.
// Design: products/content.voila.dev/docs/pivot/packages/content-sql.md
//
// The dialect subpaths (`./d1`, `./pg`, `./sqlite`) are declared as separate
// `exports` entries in `package.json` so consumers only pull the dialect
// (and its optional peer driver) they actually use — see Canon §3.

export {
  Database,
  DatabaseLive,
  type DatabaseService,
  type ListOpts,
  type ListResult,
  type Row,
} from "./database.ts";
export { DatabaseError, MigrationError } from "./error.ts";
export { NoopDatabaseLive } from "./noop.ts";
export { toColumnName } from "./to-column-name.ts";

import type { SqlClient } from "@effect/sql";
import { Effect, Layer } from "effect";
import type { DatabaseService } from "./database.ts";
import { Database } from "./database.ts";
import { MigrationError } from "./error.ts";

/**
 * Dialect-neutral table descriptor produced by `deriveSchema`. The full
 * shape is stabilised in M1 alongside the DDL generator.
 */
export interface TableSchema {
  readonly name: string;
  readonly columns: ReadonlyArray<{
    readonly name: string;
    readonly type: string;
    readonly notNull: boolean;
    readonly primaryKey?: boolean;
  }>;
  readonly checks?: ReadonlyArray<string>;
}

/** Supported SQL dialects for DDL rendering. */
export type Dialect = "sqlite" | "postgres";

/**
 * **M1 stub.** Reads `VoilaField` annotations from a list of collection
 * configs and produces dialect-neutral `TableSchema[]`. Throws at runtime
 * in M0 — exported so the public API surface is stable.
 */
export function deriveSchema(_collections: ReadonlyArray<unknown>): ReadonlyArray<TableSchema> {
  throw new Error("@voila/content-sql: deriveSchema lands in M1");
}

/**
 * **M1 stub.** Renders `CREATE TABLE` SQL from `TableSchema[]` for the given
 * dialect. Throws at runtime in M0.
 */
export function generateDDL(_tables: ReadonlyArray<TableSchema>, _dialect: Dialect): string {
  throw new Error("@voila/content-sql: generateDDL lands in M1");
}

/**
 * **M1 stub.** Wires `@effect/sql/Migrator` against the resolved `Database`
 * + `SqlClient`. M0 exposes a Layer that fails with `MigrationError({ cause:
 * "M1" })` so consumers can pattern-match on the public error type today.
 */
export const MigratorLive: Layer.Layer<
  never,
  MigrationError,
  DatabaseService | SqlClient.SqlClient
> = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Database;
    return yield* Effect.fail(new MigrationError({ cause: "M1" }));
  }),
);
