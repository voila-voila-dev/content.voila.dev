// Dialect-neutral table descriptors. `deriveSchema` returns these from a
// config; `generateDDL` renders them as `CREATE TABLE` / `CREATE INDEX` for
// a chosen dialect. Splitting the two steps keeps field-kind → column-shape
// decisions in one place, and per-dialect quoting / type-name choices in
// another.

export type Dialect = "sqlite" | "postgres";

/**
 * A column in a generated table. `type` carries the rendered type strings for
 * each dialect because the same logical column (e.g. a localized field) maps
 * to different physical types (SQLite `TEXT` vs Postgres `JSONB`).
 */
export interface ColumnSchema {
  /** Quoted-as-is column name; already snake_case. */
  readonly name: string;
  /** Original field name (camelCase) — handy for error messages and tests. */
  readonly fieldName: string;
  /** Per-dialect rendered SQL type, e.g. `{ sqlite: "TEXT", postgres: "JSONB" }`. */
  readonly type: { readonly sqlite: string; readonly postgres: string };
  readonly notNull: boolean;
  readonly primaryKey?: boolean;
  /** Per-dialect default expression (inlined verbatim into the column DDL). */
  readonly defaultExpr?: { readonly sqlite?: string; readonly postgres?: string };
}

export interface IndexSchema {
  readonly name: string;
  readonly table: string;
  readonly columns: ReadonlyArray<string>;
  readonly unique: boolean;
}

export interface TableSchema {
  readonly name: string;
  readonly columns: ReadonlyArray<ColumnSchema>;
  readonly indexes: ReadonlyArray<IndexSchema>;
  /**
   * Set for singleton tables — emitted as a table-level
   * `CHECK ("id" = '<value>')` so only one row can ever exist.
   */
  readonly singletonCheck?: { readonly id: string };
  /** True when the collection opted into draft/published workflow — the table
   *  carries `status` + `published_at` columns and reads scope to live rows. */
  readonly drafts?: boolean;
  /** True when the collection opted into version history — content writes
   *  snapshot the stored row into the engine-owned `voila_revisions` table. */
  readonly revisions?: boolean;
  /** True for engine-owned tables (e.g. `voila_revisions`) that ship with the
   *  schema but aren't collections — the runtime `Database` doesn't expose them. */
  readonly system?: boolean;
}
