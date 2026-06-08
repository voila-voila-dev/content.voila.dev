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

const renderTable = (table: TableSchema, dialect: Dialect): string => {
  const lines = table.columns.map((c) => `  ${renderColumn(c, dialect)}`);
  if (table.singletonCheck) {
    // Single-row guarantee for singletons. Quoting the literal as a SQL
    // string is enough — slugs are validated upstream.
    lines.push(`  CHECK ("id" = '${table.singletonCheck.id}')`);
  }
  return `CREATE TABLE ${quote(table.name)} (\n${lines.join(",\n")}\n);`;
};

const renderIndex = (idx: IndexSchema): string => {
  const unique = idx.unique ? "UNIQUE " : "";
  const cols = idx.columns.map(quote).join(", ");
  return `CREATE ${unique}INDEX ${quote(idx.name)} ON ${quote(idx.table)} (${cols});`;
};

export const generateDDL = (tables: ReadonlyArray<TableSchema>, dialect: Dialect): string => {
  const blocks: string[] = [];
  for (const table of tables) {
    const block: string[] = [renderTable(table, dialect)];
    for (const idx of table.indexes) block.push(renderIndex(idx));
    blocks.push(block.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
};
