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
// DDL pipeline (M1 — schema → dialect-neutral descriptors → executable SQL).
export {
  assertValidFieldName,
  assertValidSlug,
  type CheckSchema,
  type CollectionConfig,
  type ColumnKind,
  type ColumnSchema,
  type Dialect,
  deriveSchema,
  generateDDL,
  IDENT_RE,
  type IndexSchema,
  SYSTEM_COLUMN_NAMES,
  SYSTEM_COLUMNS,
  type TableSchema,
} from "./ddl/index.ts";
export { DatabaseError, MigrationError } from "./error.ts";
export { NoopDatabaseLive } from "./noop.ts";
export { toColumnName } from "./to-column-name.ts";

import type { SqlClient } from "@effect/sql";
import { Effect, Layer } from "effect";
import type { DatabaseService } from "./database.ts";
import { Database } from "./database.ts";
import { MigrationError } from "./error.ts";

/**
 * **M1 epic 3 stub.** Wires `@effect/sql/Migrator` against the resolved
 * `Database` + `SqlClient`. Currently exposes a Layer that fails with
 * `MigrationError({ cause: "M1" })` so consumers can pattern-match on the
 * public error type today; the real impl lands with `voila migrate
 * generate|apply`.
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
