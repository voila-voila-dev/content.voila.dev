// `makeD1Driver` — a `SqlDriver` over a Cloudflare D1 binding, for the worker
// runtime. The binding is supplied per-request by the Cloudflare runtime
// (`env.DATABASE`), so the host builds the driver inside the request scope. D1
// is SQLite under the hood, so row shapes and the read/write path are identical
// to `makeSqliteDriver` — only the connection differs.

import { coerceBindings, type SqlDriver, type SqlRow, type SqlValue } from "./driver";

// A minimal structural view of the D1 binding (a subset of
// `@cloudflare/workers-types`' `D1Database`) so this package needs no Cloudflare
// types dependency. The worker's real `env.DATABASE` satisfies it structurally.
export interface D1PreparedStatement {
  bind(...values: ReadonlyArray<SqlValue>): D1PreparedStatement;
  all<T = SqlRow>(): Promise<{ readonly results: ReadonlyArray<T> }>;
  run(): Promise<unknown>;
}

export interface D1Binding {
  prepare(query: string): D1PreparedStatement;
}

export function makeD1Driver(binding: D1Binding): SqlDriver {
  return {
    async all(sql: string, params: ReadonlyArray<SqlValue> = []): Promise<ReadonlyArray<SqlRow>> {
      const { results } = await binding
        .prepare(sql)
        .bind(...coerceBindings(params))
        .all<SqlRow>();
      return results;
    },
    async run(sql: string, params: ReadonlyArray<SqlValue> = []): Promise<void> {
      await binding
        .prepare(sql)
        .bind(...coerceBindings(params))
        .run();
    },
  };
}
