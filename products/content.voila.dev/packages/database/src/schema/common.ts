import type { AnyFieldDef } from "@voila/content-schema";
import { type SQL, sql } from "drizzle-orm";

/**
 * Common types, validators, and dialect-agnostic helpers shared by the
 * sqlite and postgres builders.
 */

export type CollectionLike = {
  readonly kind: "collection" | "singleton";
  readonly slug: string;
  readonly fields: Record<string, AnyFieldDef>;
};

/**
 * Field keys and underlying column names that may not be used by user fields.
 * Includes both the camelCase keys (`createdAt`) and the snake_case column
 * names (`created_at`) we emit — a field literally named `created_at` would
 * otherwise produce a duplicate-column CREATE TABLE.
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
 * digits, or underscores. Bounded to 60 chars so unique-constraint names
 * (`<slug>_<col>_unique`) stay under PostgreSQL's 63-byte limit.
 */
export const IDENT_RE: RegExp = /^[A-Za-z_][A-Za-z0-9_]{0,59}$/;

/**
 * Pure-SQL UUID v4 generators used as the DB-level default for `id`.
 *
 * Why DB-level: every row has a UUID for its id, always — even if a raw SQL
 * INSERT forgets to set it. The runtime write path (M2) can still pass an
 * explicit id and the default is skipped.
 *
 * The sqlite expression is the canonical hex-shuffle pattern; postgres uses
 * `gen_random_uuid()` from the `pgcrypto`-derived built-in (pg ≥ 13).
 */
export const SQLITE_UUID_DEFAULT: SQL = sql`(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))`;
export const POSTGRES_UUID_DEFAULT: SQL = sql`gen_random_uuid()`;

/** Convert camelCase field names to snake_case column names. */
export function toColumnName(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function assertValidCollection(c: CollectionLike): void {
  if (!IDENT_RE.test(c.slug)) {
    throw new Error(
      `schemaToTables: invalid slug "${c.slug}" — must match ${IDENT_RE.source} (letters, digits, underscores; ≤60 chars)`,
    );
  }
  for (const name of Object.keys(c.fields)) {
    if (SYSTEM_COLUMN_NAMES.has(name) || SYSTEM_COLUMN_NAMES.has(toColumnName(name))) {
      throw new Error(
        `schemaToTables: field "${name}" in collection "${c.slug}" collides with a reserved system column`,
      );
    }
    if (!IDENT_RE.test(name)) {
      throw new Error(
        `schemaToTables: invalid field name "${name}" in collection "${c.slug}" — must match ${IDENT_RE.source}`,
      );
    }
  }
}

/**
 * Apply the `required` / `unique` modifiers in a type-safe way. Drizzle's
 * column builders share these methods structurally, so a single generic that
 * captures "has notNull() and unique() and returns this" works across sqlite
 * and pg builders without any `as unknown as` cast.
 */
export function withMods<T extends { notNull(): T; unique(): T }>(col: T, field: AnyFieldDef): T {
  let c = col;
  if (field.required) c = c.notNull();
  if (field.unique) c = c.unique();
  return c;
}

export function unknownKind(kind: string, name: string): Error {
  return new Error(
    `schemaToTables: unknown field kind "${kind}" for column "${name}". Custom fields must declare a kind that maps to a known column type.`,
  );
}

/**
 * Build the `<id-column> = '<slug>'` SQL expression for a singleton's CHECK.
 *
 * Uses `sql.raw` for the slug literal: `sql\`= ${slug}\`` would bind the slug
 * as a parameter, but parameters aren't valid inside DDL — drizzle-kit would
 * emit `CHECK (id = ?)` which sqlite/postgres reject at apply time.
 *
 * Safe because slugs are validated by `assertValidCollection` to match
 * `IDENT_RE` (letters/digits/underscores only) before reaching this helper —
 * no quote or backslash can appear inside the literal.
 */
export function singletonCheckSql(idCol: unknown, slug: string): SQL {
  return sql`${idCol} = ${sql.raw(`'${slug}'`)}`;
}
