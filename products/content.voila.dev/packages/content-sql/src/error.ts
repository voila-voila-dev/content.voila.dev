// @voila/content-sql — typed domain errors.
// Design: products/content.voila.dev/docs/pivot/packages/content-sql.md §"Effect surface"

import type { Cause } from "effect";
import { Data } from "effect";

// `Data.TaggedError(tag)` returns an anonymous class constructor whose type
// can't be inferred by `--isolatedDeclarations`. We capture the base class
// in a typed variable so the `extends` clause references a named type.
type DatabaseErrorBase = new (args: {
  readonly cause: unknown;
}) => Cause.YieldableError & { readonly _tag: "DatabaseError"; readonly cause: unknown };
const DatabaseErrorBase: DatabaseErrorBase = Data.TaggedError("DatabaseError")<{ cause: unknown }>;

/**
 * Raised by any `Database` service method when an underlying SQL operation
 * fails (driver error, constraint violation, mapping failure, etc.). M0
 * methods that are not yet implemented also fail with this tag so call sites
 * can pattern-match on a single discriminator.
 */
export class DatabaseError extends DatabaseErrorBase {}

type MigrationErrorBase = new (args: {
  readonly cause: unknown;
}) => Cause.YieldableError & { readonly _tag: "MigrationError"; readonly cause: unknown };
const MigrationErrorBase: MigrationErrorBase = Data.TaggedError("MigrationError")<{
  cause: unknown;
}>;

/**
 * Raised by the migrator (`MigratorLive`, lands M1) when generation or
 * application of a migration fails. Exposed in M0 so the public type surface
 * is stable.
 */
export class MigrationError extends MigrationErrorBase {}
