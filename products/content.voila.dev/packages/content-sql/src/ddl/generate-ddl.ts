// @voila/content-sql — render `TableSchema[]` to a `CREATE TABLE` / `CREATE INDEX` script.
//
// Output is deliberately:
//   - executable as-is by `@effect/sql/Migrator` (no placeholders, no shell
//     metacharacters, semicolon-terminated statements);
//   - stable across runs (column order = derive order; sorted by table name
//     would break the goldens — we keep insertion order so the user can read
//     the script in the same order they wrote `collections`);
//   - dialect-specific (column types + timestamp defaults differ between
//     SQLite and Postgres; structure does not).

import type { ColumnKind, ColumnSchema, Dialect, IndexSchema, TableSchema } from "./types.ts";

// --- column type rendering --------------------------------------------------

/**
 * Per-dialect type strings. Lowercased to match the conventional output of
 * `pg_dump` / `sqlite .schema` so committed goldens read like a real export.
 */
const COLUMN_TYPES: Record<Dialect, Record<ColumnKind, string>> = {
  sqlite: {
    id: "text",
    createdAt: "integer",
    updatedAt: "integer",
    deletedAt: "integer",
    string: "text",
    number: "real",
    integer: "integer",
    boolean: "integer", // 0 / 1
    date: "text", // ISO YYYY-MM-DD
    datetime: "integer", // ms since epoch
    json: "text", // serialized JSON string
    select: "text",
    slug: "text",
  },
  postgres: {
    id: "text",
    createdAt: "timestamp with time zone",
    updatedAt: "timestamp with time zone",
    deletedAt: "timestamp with time zone",
    string: "text",
    number: "real",
    integer: "integer",
    boolean: "boolean",
    date: "date",
    datetime: "timestamp with time zone",
    json: "jsonb",
    select: "text",
    slug: "text",
  },
};

/**
 * Per-dialect default expression for the timestamp system columns. Returns
 * `null` for kinds that have no DB-level default (`id` is runtime-minted;
 * user columns never carry a default at the DDL layer in M1).
 */
const defaultExprFor = (kind: ColumnKind, dialect: Dialect): string | null => {
  if (kind !== "createdAt" && kind !== "updatedAt") return null;
  return dialect === "sqlite" ? "(unixepoch() * 1000)" : "now()";
};

// --- statement renderers ----------------------------------------------------

const renderColumn = (col: ColumnSchema, dialect: Dialect): string => {
  const parts: string[] = [`"${col.name}"`, COLUMN_TYPES[dialect][col.kind]];
  if (col.primaryKey === true) parts.push("primary key");
  if (col.notNull) parts.push("not null");
  if (col.unique === true) parts.push("unique");
  const def = defaultExprFor(col.kind, dialect);
  if (def !== null) parts.push(`default ${def}`);
  return `  ${parts.join(" ")}`;
};

const renderTable = (table: TableSchema, dialect: Dialect): string => {
  const lines: string[] = table.columns.map((c) => renderColumn(c, dialect));
  for (const check of table.checks) {
    lines.push(`  constraint "${check.name}" check (${check.expr})`);
  }
  return `create table "${table.name}" (\n${lines.join(",\n")}\n);`;
};

const renderIndex = (table: TableSchema, idx: IndexSchema): string =>
  `create index "${idx.name}" on "${table.name}" ("${idx.column}");`;

/**
 * Render a list of `TableSchema` into a single executable DDL script for
 * the given dialect. Each `CREATE TABLE` is followed by its `CREATE INDEX`
 * statements; tables are separated by a blank line. The script ends with a
 * trailing newline (POSIX file).
 */
export const generateDDL = (tables: ReadonlyArray<TableSchema>, dialect: Dialect): string => {
  const blocks: string[] = [];
  for (const table of tables) {
    const block: string[] = [renderTable(table, dialect)];
    for (const idx of table.indexes) {
      block.push(renderIndex(table, idx));
    }
    blocks.push(block.join("\n"));
  }
  return `${blocks.join("\n\n")}\n`;
};
