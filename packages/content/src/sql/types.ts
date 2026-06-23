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
  /**
   * Index method (Postgres `USING <method>`), e.g. `"gin"` for a full-text index.
   * Omitted for a plain b-tree index over `columns`.
   */
  readonly using?: string;
  /**
   * A raw indexed expression (Postgres), e.g. `to_tsvector('simple', "content")`.
   * When set it replaces the `columns` list in the rendered DDL. Only meaningful
   * for the Postgres dialect — SQLite full-text uses an FTS5 virtual table, not an
   * expression index (see {@link FtsSpec}).
   */
  readonly expression?: string;
}

/**
 * Marks a table as a full-text index. SQLite renders it as a `CREATE VIRTUAL
 * TABLE … USING fts5(…)`; Postgres renders a plain table plus a GIN index (the
 * table's {@link IndexSchema} carries the `using`/`expression`). The runtime
 * `Database` only drives the SQLite/D1 form today — Postgres FTS DDL renders so
 * it migrates, mirroring the rest of the Postgres-is-DDL-only status.
 */
export interface FtsSpec {
  readonly module: "fts5";
  /** The single indexed text column. */
  readonly content: string;
  /** Columns carried for filtering/joins but not tokenized (FTS5 `UNINDEXED`). */
  readonly unindexed: ReadonlyArray<string>;
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
  /** Set for a full-text index table — rendered as an FTS5 virtual table
   *  (SQLite) or a table + GIN index (Postgres). See {@link FtsSpec}. */
  readonly fts?: FtsSpec;
  /** True for engine-owned tables (e.g. `voila_revisions`) that ship with the
   *  schema but aren't collections — the runtime `Database` doesn't expose them. */
  readonly system?: boolean;
}
