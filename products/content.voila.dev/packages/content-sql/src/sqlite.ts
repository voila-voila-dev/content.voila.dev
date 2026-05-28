// @voila/content-sql/sqlite — SQLite (`bun:sqlite`) `SqlClient` Layer.
// Design: products/content.voila.dev/docs/pivot/packages/content-sql.md
//
// Wraps `@effect/sql-sqlite-bun`. The canonical test double for the entire
// `@voila/content-sql` suite. Local-dev backend for `bun dev` setups that
// don't use Cloudflare D1.
import type { SqlClient } from "@effect/sql";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import type { Layer } from "effect";
import type { ConfigError } from "effect/ConfigError";

/** Options accepted by `SqliteLive`. */
export interface SqliteLiveOpts {
  /**
   * libsql-style URL (`file:./local.db`), bare file path (`./local.db`), or
   * the sentinel values `:memory:` / `file::memory:` for an in-memory db.
   */
  readonly url: string;
}

/**
 * Normalise the URL form accepted by `SqliteLive` into the bare filename
 * `bun:sqlite` understands.
 *
 * - `:memory:` and `file::memory:` → `:memory:`
 * - `file:./local.db` → `./local.db` (strip `file:` scheme)
 * - Anything else is returned unchanged.
 */
export function resolveSqliteUrl(url: string): string {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}

/**
 * Build a `Layer` providing both `SqliteClient` and the generic `SqlClient`
 * tag. `Layer.scoped` semantics from `@effect/sql-sqlite-bun` ensure the
 * underlying connection closes when the surrounding `Scope` (typically the
 * `ManagedRuntime`) shuts down.
 */
export function SqliteLive(
  opts: SqliteLiveOpts,
): Layer.Layer<SqliteClient.SqliteClient | SqlClient.SqlClient, ConfigError> {
  return SqliteClient.layer({ filename: resolveSqliteUrl(opts.url) });
}
