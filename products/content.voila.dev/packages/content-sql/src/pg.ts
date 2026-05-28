// @voila/content-sql/pg — Postgres `SqlClient` Layer.
// Design: products/content.voila.dev/docs/pivot/packages/content-sql.md
//
// M0 scaffold: surface and wiring only. The real integration test against a
// live Postgres lands in M2 (see roadmap-effect.md).
import type { SqlClient } from "@effect/sql";
import type { SqlError } from "@effect/sql/SqlError";
import { PgClient } from "@effect/sql-pg";
import { type Layer, Redacted } from "effect";

/** Options accepted by `PgLive`. */
export interface PgLiveOpts {
  /**
   * Postgres connection URL, e.g. `postgres://user:pass@host:5432/db`. Stored
   * as `Redacted` internally so it never lands in logs / spans.
   */
  readonly url: string;
  /**
   * Enable TLS. Defaults to undefined (driver default — required by Neon /
   * Supabase, optional locally).
   */
  readonly ssl?: boolean | undefined;
}

/**
 * Build a `Layer` providing both `PgClient` and the generic `SqlClient` tag
 * around a Postgres URL. Connection pooling lifecycle (open lazily on first
 * query, close on `Scope` shutdown) is managed by `@effect/sql-pg`.
 */
export function PgLive(
  opts: PgLiveOpts,
): Layer.Layer<PgClient.PgClient | SqlClient.SqlClient, SqlError> {
  return PgClient.layer({
    url: Redacted.make(opts.url),
    ssl: opts.ssl,
  });
}
