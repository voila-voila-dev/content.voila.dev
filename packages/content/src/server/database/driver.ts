// The minimal SQL execution seam the `Database` talks to. Both backends speak
// positional `?` placeholders (SQLite + D1; Postgres `$n` lands with its client):
// `all` runs a row-returning query, `run` runs a mutation. Keeping the surface
// this small is what lets the SQLite (`bun:sqlite`) and D1 adapters be a dozen
// lines each, with the dialect-aware row mapping living entirely in `database.ts`.

/** A value bindable to a `?` placeholder. */
export type SqlValue = string | number | bigint | boolean | null | Uint8Array;

/** A raw row as the driver returns it: snake_case columns, driver-native value shapes. */
export type SqlRow = Record<string, unknown>;

export interface SqlDriver {
  /** Run a row-returning statement (SELECT), resolving to every row. */
  all(sql: string, params?: ReadonlyArray<SqlValue>): Promise<ReadonlyArray<SqlRow>>;
  /** Run a non-returning statement (INSERT/UPDATE/DELETE/DDL). */
  run(sql: string, params?: ReadonlyArray<SqlValue>): Promise<void>;
}

// SQLite (and D1, which is SQLite) has no boolean type and rejects a JS boolean
// bind, so normalize booleans to 0/1 at the driver boundary. Stored values are
// already coerced by `encodeRow`; this covers `findOne`/cursor lookups that pass
// a bare boolean through as a `?` parameter.
export function coerceBindings(params: ReadonlyArray<SqlValue>): Array<SqlValue> {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}
