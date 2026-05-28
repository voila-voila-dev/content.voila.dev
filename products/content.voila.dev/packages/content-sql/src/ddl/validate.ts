// @voila/content-sql — validation guards for DDL derivation.
//
// Both inputs (collection slugs, field names) and derived column names are
// guarded against:
//   - reserved system column names — user fields can't collide with `id`,
//     `createdAt`, etc., regardless of the casing they reach us in;
//   - non-identifier characters — guarantees any literal we splice into
//     `CHECK` / `CREATE INDEX` is SQL-injection-safe (no quotes, backslashes,
//     or spaces can appear in a passing identifier).

import { toColumnName } from "../to-column-name.ts";

/**
 * Field keys *and* underlying column names that may not be used by user
 * fields. We list both the camelCase keys and the snake_case columns we emit
 * so a field literally named `created_at` is rejected with the same error.
 */
export const SYSTEM_COLUMN_NAMES: ReadonlySet<string> = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "created_at",
  "updated_at",
  "deleted_at",
]);

/**
 * SQL-safe identifier: starts with a letter or underscore, then letters,
 * digits, or underscores. Bounded to 60 chars so derived names
 * (`<slug>_<col>_idx`, `<slug>_singleton`) stay under PostgreSQL's 63-byte
 * limit even with their suffixes.
 */
export const IDENT_RE: RegExp = /^[A-Za-z_][A-Za-z0-9_]{0,59}$/;

/**
 * Reject collection configs that would emit unsafe or duplicated DDL. Throws
 * on first failure so the CLI surfaces a precise error (`generate` is a
 * one-shot pipeline — partial output isn't useful).
 */
export const assertValidSlug = (slug: string): void => {
  if (!IDENT_RE.test(slug)) {
    throw new Error(
      `@voila/content-sql: invalid slug "${slug}" — must match ${IDENT_RE.source} (letters, digits, underscores; ≤60 chars)`,
    );
  }
};

export const assertValidFieldName = (slug: string, name: string): void => {
  if (SYSTEM_COLUMN_NAMES.has(name) || SYSTEM_COLUMN_NAMES.has(toColumnName(name))) {
    throw new Error(
      `@voila/content-sql: field "${name}" in collection "${slug}" collides with a reserved system column (id, createdAt, updatedAt, deletedAt)`,
    );
  }
  if (!IDENT_RE.test(name)) {
    throw new Error(
      `@voila/content-sql: invalid field name "${name}" in collection "${slug}" — must match ${IDENT_RE.source}`,
    );
  }
};
