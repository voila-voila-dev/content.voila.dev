// `SqliteLive` — a `Layer<SqlClient>` for local development, migrations, and as
// the universal test double. Wraps `@effect/sql-sqlite-bun` (which uses the
// built-in `bun:sqlite` driver) so the engine's `SqlClient` seam resolves
// without a separate database process.

import type { SqlClient } from "@effect/sql/SqlClient";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import type { ConfigError, Layer } from "effect";

export interface SqliteLiveOpts {
  /** libsql-style URL (`file:./local.db`, `:memory:`) or a bare file path. */
  readonly url: string;
}

/**
 * Normalizes a libsql-style URL to a `bun:sqlite` filename.
 *
 * - `:memory:` / `file::memory:` → `:memory:` (anonymous in-memory db)
 * - `file:./local.db` / `file:/abs/local.db` → strips the `file:` scheme
 * - bare paths pass through unchanged
 */
export const resolveSqliteUrl = (url: string): string => {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
};

/**
 * Constructs a `SqlClient` (and the underlying `SqliteClient`) from a file URL.
 * The connection is opened on first use and closed on `Layer` teardown.
 */
export const SqliteLive = (
  opts: SqliteLiveOpts,
): Layer.Layer<SqlClient | SqliteClient.SqliteClient, ConfigError.ConfigError> =>
  SqliteClient.layer({ filename: resolveSqliteUrl(opts.url) });
