// Render TableSchema[] → a CREATE TABLE + CREATE INDEX script for the chosen
// dialect. The output is stable and goldens-friendly: columns are emitted in
// the order they appear in the schema, indexes follow each table, tables
// are separated by a blank line, and the script ends with a single newline.

import type { ColumnSchema, Dialect, IndexSchema, TableSchema } from "@voila/content/sql";

const quote = (ident: string): string => `"${ident}"`;

const renderColumn = (col: ColumnSchema, dialect: Dialect): string => {
  const parts = [quote(col.name), col.type[dialect]];
  if (col.primaryKey) parts.push("PRIMARY KEY");
  if (col.notNull) parts.push("NOT NULL");
  const defaultExpr = col.defaultExpr?.[dialect];
  if (defaultExpr !== undefined) parts.push(`DEFAULT ${defaultExpr}`);
  return parts.join(" ");
};

// An FTS5 virtual table (SQLite only): bare column names, the carried columns
// flagged `UNINDEXED`. FTS5 manages its own index, so the table's `IndexSchema`
// rows aren't emitted for this dialect.
const renderFtsVirtual = (table: TableSchema): string => {
  const unindexed = new Set(table.fts?.unindexed ?? []);
  const cols = table.columns.map((c) => (unindexed.has(c.name) ? `${c.name} UNINDEXED` : c.name));
  return `CREATE VIRTUAL TABLE ${quote(table.name)} USING fts5(${cols.join(", ")});`;
};

const renderTable = (table: TableSchema, dialect: Dialect): string => {
  // SQLite full-text tables are FTS5 virtual tables; every other shape (and the
  // Postgres rendering of a full-text table) is a plain `CREATE TABLE`.
  if (table.fts && dialect === "sqlite") return renderFtsVirtual(table);
  const lines = table.columns.map((c) => `  ${renderColumn(c, dialect)}`);
  if (table.singletonCheck) {
    // Single-row guarantee for singletons. Quoting the literal as a SQL
    // string is enough — slugs are validated upstream.
    lines.push(`  CHECK ("id" = '${table.singletonCheck.id}')`);
  }
  return `CREATE TABLE ${quote(table.name)} (\n${lines.join(",\n")}\n);`;
};

const renderIndex = (idx: IndexSchema, dialect: Dialect): string => {
  const unique = idx.unique ? "UNIQUE " : "";
  const using = idx.using ? ` USING ${idx.using}` : "";
  // An expression index (Postgres GIN over `to_tsvector(...)`) carries its target
  // as a raw expression; a plain index lists quoted columns.
  const target = idx.expression !== undefined ? idx.expression : idx.columns.map(quote).join(", ");
  return `CREATE ${unique}INDEX ${quote(idx.name)} ON ${quote(idx.table)}${using} (${target});`;
};

export function generateDDL(tables: ReadonlyArray<TableSchema>, dialect: Dialect): string {
  const blocks: string[] = [];
  for (const table of tables) {
    const block: string[] = [renderTable(table, dialect)];
    // FTS5 self-indexes on SQLite, so the GIN-index row (Postgres-only) is skipped.
    const skipIndexes = table.fts !== undefined && dialect === "sqlite";
    if (!skipIndexes) for (const idx of table.indexes) block.push(renderIndex(idx, dialect));
    blocks.push(block.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
}
