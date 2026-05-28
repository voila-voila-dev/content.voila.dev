// @voila/content-sql — schema → dialect-neutral `TableSchema[]`.
//
// Reads `VoilaField` annotations off each `Schema` in `collection.fields`
// and produces the descriptors the DDL renderer consumes. Pure: no IO, no
// Effect, no dialect logic.

import { getFieldMeta } from "@voila/content-schema";
import type { Schema } from "effect";
import { toColumnName } from "../to-column-name.ts";
import { SYSTEM_COLUMNS } from "./system-columns.ts";
import type {
  CheckSchema,
  CollectionConfig,
  ColumnKind,
  ColumnSchema,
  IndexSchema,
  TableSchema,
} from "./types.ts";
import { assertValidFieldName, assertValidSlug } from "./validate.ts";

/**
 * Map a `VoilaField` `kind` discriminator to the `ColumnKind` the renderer
 * understands. The runtime widget kinds are a superset (e.g. `select`/`slug`
 * both surface as TEXT) but stay distinct here so callers can read back the
 * original intent if they ever introspect a `TableSchema`.
 */
const columnKindFor = (fieldKind: string, integer: boolean): ColumnKind => {
  switch (fieldKind) {
    case "string":
      return "string";
    case "number":
      return integer ? "integer" : "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "datetime":
      return "datetime";
    case "json":
      return "json";
    case "select":
      return "select";
    case "slug":
      return "slug";
    default:
      throw new Error(
        `@voila/content-sql: unknown field kind "${fieldKind}". Custom kinds registered via defineField must map to a known column type.`,
      );
  }
};

/**
 * Build one `ColumnSchema` from a `(fieldName, schema)` pair. Reads the
 * `VoilaField` annotation; a field that carries none is a programmer error
 * (the schema bypassed `@voila/content-schema` constructors) — throw with a
 * pointer to the right surface.
 */
const columnFor = (slug: string, name: string, schema: Schema.Schema.Any): ColumnSchema => {
  const meta = getFieldMeta(schema);
  if (meta === null) {
    throw new Error(
      `@voila/content-sql: field "${name}" in collection "${slug}" is missing the VoilaField annotation — build it with a constructor from @voila/content-schema (or defineField).`,
    );
  }
  // `integer` only exists on NumberFieldMeta; widen-then-narrow keeps the
  // structural read total without a switch over every meta kind.
  const integer = (meta as { readonly integer?: boolean }).integer === true;
  return {
    name: toColumnName(name),
    kind: columnKindFor(meta.kind, integer),
    notNull: meta.required === true,
    unique: meta.unique === true ? true : undefined,
  };
};

/**
 * Derive secondary-index descriptors from field meta. `unique` already gives
 * the column an implicit index via `UNIQUE`, so we only emit explicit indexes
 * for `index: true`.
 */
const indexesFor = (
  slug: string,
  fields: Readonly<Record<string, Schema.Schema.Any>>,
): ReadonlyArray<IndexSchema> => {
  const out: IndexSchema[] = [];
  for (const [name, schema] of Object.entries(fields)) {
    const meta = getFieldMeta(schema);
    if (meta === null) continue;
    const indexed = (meta as { readonly index?: boolean }).index === true;
    const unique = meta.unique === true;
    if (indexed && !unique) {
      const col = toColumnName(name);
      out.push({ name: `${slug}_${col}_idx`, column: col });
    }
  }
  return out;
};

/**
 * Singleton tables get a `CHECK (id = '<slug>')` constraint so only the
 * pre-blessed row can ever exist. The slug has already passed `IDENT_RE`,
 * so the literal is safe to splice into the expression.
 */
const checksFor = (config: CollectionConfig): ReadonlyArray<CheckSchema> => {
  if (config.kind !== "singleton") return [];
  return [{ name: `${config.slug}_singleton`, expr: `id = '${config.slug}'` }];
};

/**
 * Convert a list of collection configs into dialect-neutral `TableSchema[]`.
 *
 * - System columns (`id` ulid, `createdAt`, `updatedAt`, `deletedAt`) are
 *   prepended to every table.
 * - User field names are validated against the reserved set and an SQL-safe
 *   identifier regex.
 * - Singletons get a `CHECK (id = '<slug>')` constraint.
 *
 * Throws synchronously on the first validation failure — the CLI surfaces
 * the message; the runtime never reaches `deriveSchema`.
 */
export const deriveSchema = (
  collections: ReadonlyArray<CollectionConfig>,
): ReadonlyArray<TableSchema> => {
  const tables: TableSchema[] = [];
  for (const config of collections) {
    assertValidSlug(config.slug);
    const userColumns: ColumnSchema[] = [];
    for (const [name, schema] of Object.entries(config.fields)) {
      assertValidFieldName(config.slug, name);
      userColumns.push(columnFor(config.slug, name, schema));
    }
    tables.push({
      name: config.slug,
      columns: [...SYSTEM_COLUMNS, ...userColumns],
      indexes: indexesFor(config.slug, config.fields),
      checks: checksFor(config),
    });
  }
  return tables;
};
