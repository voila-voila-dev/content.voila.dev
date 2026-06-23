// A tiny SQL fragment builder — the pure-TS stand-in for `@effect/sql`'s tagged
// template. It only does what the `Database` needs: quote identifiers, AND/OR
// keyset predicates, and assemble INSERT / UPDATE-SET clauses with positional
// `?` params. Identifiers always come from the schema descriptor (column names
// validated against the table), never raw caller input, so quoting is belt-and-
// braces rather than the injection boundary.

import type { SqlValue } from "./driver";

/** A SQL text fragment plus the ordered `?` parameters it introduces. */
export interface Sql {
  readonly text: string;
  readonly params: ReadonlyArray<SqlValue>;
}

/** Double-quote an identifier (escaping embedded quotes). */
export const quoteId = (name: string): string => `"${name.replace(/"/g, '""')}"`;

/** A leaf fragment: literal text with its bound params. */
export const frag = (text: string, params: ReadonlyArray<SqlValue> = []): Sql => ({ text, params });

function combine(parts: ReadonlyArray<Sql>, sep: string): Sql {
  // A single part needs no wrapping parens (and `parts[0]` is always present here).
  if (parts.length === 1) return parts[0] as Sql;
  const params: Array<SqlValue> = [];
  for (const part of parts) params.push(...part.params);
  return { text: `(${parts.map((p) => p.text).join(sep)})`, params };
}

/** Combine fragments with `AND`, parenthesized when there's more than one. */
export const and = (parts: ReadonlyArray<Sql>): Sql => combine(parts, " AND ");

/** Combine fragments with `OR`, parenthesized when there's more than one. */
export const or = (parts: ReadonlyArray<Sql>): Sql => combine(parts, " OR ");

/** `INSERT INTO "<table>" (...cols) VALUES (...?)` for an encoded row. */
export function buildInsert(table: string, row: Record<string, SqlValue>): Sql {
  const entries = Object.entries(row);
  const columns = entries.map(([col]) => quoteId(col)).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  return {
    text: `INSERT INTO ${quoteId(table)} (${columns}) VALUES (${placeholders})`,
    params: entries.map(([, value]) => value),
  };
}

/** The `SET "col" = ?, ...` clause (and its params) for an encoded row. */
export function buildUpdateSet(row: Record<string, SqlValue>): Sql {
  const entries = Object.entries(row);
  return {
    text: entries.map(([col]) => `${quoteId(col)} = ?`).join(", "),
    params: entries.map(([, value]) => value),
  };
}
