// `D1Live` — a `Layer<SqlClient>` over a Cloudflare D1 binding, for the worker
// runtime. Mirrors `SqliteLive` (the local/test client) but wraps
// `@effect/sql-d1`'s `D1Client` around the `env.DATABASE` binding handed to the
// worker. The engine only ever sees the `SqlClient` seam, so the read path,
// migrations-shape, and document decoding are identical to SQLite — only the
// connection differs.

import type { SqlClient } from "@effect/sql/SqlClient";
import { D1Client } from "@effect/sql-d1";
import type { ConfigError, Layer } from "effect";

/** The Cloudflare D1 binding type, taken from `@effect/sql-d1` so this file
 *  needs no direct `@cloudflare/workers-types` dependency. */
export type D1Binding = Parameters<typeof D1Client.layer>[0]["db"];

export interface D1LiveOpts {
  /** The D1 binding from the worker `env` (e.g. `env.DATABASE`). */
  readonly binding: D1Binding;
}

/**
 * Construct a `SqlClient` (and the underlying `D1Client`) from a D1 binding. The
 * binding is supplied per-request by the Cloudflare runtime, so the host builds
 * this layer inside the request/worker scope.
 */
export const D1Live = (
  opts: D1LiveOpts,
): Layer.Layer<SqlClient | D1Client.D1Client, ConfigError.ConfigError> =>
  D1Client.layer({ db: opts.binding });
