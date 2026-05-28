// @voila/content-sql/d1 — Cloudflare D1 `SqlClient` Layer.
// Design: products/content.voila.dev/docs/pivot/packages/content-sql.md
//
// Wraps `@effect/sql-d1` around a raw D1 binding (typically `env.DATABASE`
// inside a Worker). We deliberately type `D1Database` as an opaque local
// interface so consumers of `@voila/content-sql/d1` do NOT pull in
// `@cloudflare/workers-types` transitively — the Worker runtime supplies
// the real binding at call time.
import type { SqlClient } from "@effect/sql";
import { D1Client } from "@effect/sql-d1";
import type { Layer } from "effect";
import type { ConfigError } from "effect/ConfigError";

/**
 * Structural placeholder for `@cloudflare/workers-types`'s `D1Database`.
 * Workers consumers pass `env.DATABASE` (which satisfies the real interface
 * at runtime); we treat it as opaque to keep our import graph CF-free.
 */
export interface D1Database {
  readonly __brand?: "D1Database";
}

/** Options accepted by `D1Live`. */
export interface D1LiveOpts {
  /** The D1 binding from `env`, e.g. `env.DATABASE`. */
  readonly binding: D1Database;
}

/** Concrete `db` parameter shape expected by `@effect/sql-d1`. */
type SqlD1Database = Parameters<typeof D1Client.layer>[0]["db"];

/**
 * Build a `Layer` providing both `D1Client` and the generic `SqlClient` tag
 * around a Cloudflare D1 binding. Connection lifecycle is owned by the D1
 * runtime — no scope teardown work is required here.
 */
export function D1Live(
  opts: D1LiveOpts,
): Layer.Layer<D1Client.D1Client | SqlClient.SqlClient, ConfigError> {
  // `@effect/sql-d1` types `db` against the real `@cloudflare/workers-types`
  // `D1Database`. Our opaque placeholder is structurally compatible at
  // runtime; bridge through `unknown` at this single boundary so consumers
  // stay CF-free without losing the target type at the call site.
  return D1Client.layer({ db: opts.binding as unknown as SqlD1Database });
}
