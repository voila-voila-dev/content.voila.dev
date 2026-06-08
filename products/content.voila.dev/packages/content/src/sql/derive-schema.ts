// Walk every collection + singleton in a NormalizedConfig and emit a
// dialect-neutral TableSchema per slug. Column shape is decided here once,
// then rendered to dialect-specific SQL by `generateDDL`.
//
// Localized fields short-circuit kind-based mapping: they always store JSON
// (SQLite TEXT, Postgres JSONB) because the value is `Record<Locale, T>`.
//
// Unique fields don't get a column-level `UNIQUE` — they get a
// `CREATE UNIQUE INDEX` so partial-index semantics (e.g. `WHERE deleted_at
// IS NULL`) can be added later without rewriting the table.

import type { NormalizedConfig } from "../config/config";
import type { FieldsMap } from "../config/schema/fields";
import { toColumnName } from "./to-column-name";
import type { ColumnSchema, IndexSchema, TableSchema } from "./types";

/** A single field value out of a `FieldsMap` (`@voila/content` doesn't surface
 *  the bare `Field` type at its root). */
type AnyField = FieldsMap[string];

// The deriver reads a few kind-specific keys (`integer` on number, `many` on
// relation) that don't live on the wide `FieldMetaBase`. This lite view widens
// `field.meta` to expose them; the index signature keeps unknown third-party
// keys readable too.
interface FieldMetaLite {
  readonly kind: string;
  readonly localized?: boolean;
  readonly required?: boolean;
  readonly unique?: boolean;
  readonly integer?: boolean;
  readonly many?: boolean;
  readonly column?: string;
  readonly [extra: string]: unknown;
}

function readMeta(field: AnyField): FieldMetaLite {
  return field.meta as FieldMetaLite;
}

const JSON_TYPE = { sqlite: "TEXT", postgres: "JSONB" } as const;
const TEXT = { sqlite: "TEXT", postgres: "TEXT" } as const;
const INTEGER = { sqlite: "INTEGER", postgres: "BIGINT" } as const;
const REAL = { sqlite: "REAL", postgres: "DOUBLE PRECISION" } as const;
const BOOLEAN = { sqlite: "INTEGER", postgres: "BOOLEAN" } as const;
const DATE_ONLY = { sqlite: "TEXT", postgres: "DATE" } as const;
const DATETIME = { sqlite: "INTEGER", postgres: "TIMESTAMPTZ" } as const;
const TIME_ONLY = { sqlite: "TEXT", postgres: "TIME" } as const;

function columnTypeFor(meta: FieldMetaLite): ColumnSchema["type"] {
  // Localized fields stash a per-locale record — always JSON.
  if (meta.localized) return JSON_TYPE;
  switch (meta.kind) {
    case "string":
    case "id":
    case "slug":
    case "enum":
    case "select":
    case "color":
    case "code":
    case "markdown":
    case "secret":
    case "password":
      return TEXT;
    case "number":
      return meta.integer ? INTEGER : REAL;
    case "boolean":
      return BOOLEAN;
    case "date":
      return DATE_ONLY;
    case "datetime":
      return DATETIME;
    case "time":
      return TIME_ONLY;
    case "duration":
      // Stored as a non-negative integer number of seconds (matches the
      // `Schema.Int` field type); rendered to an ISO-8601 string at the edge.
      return INTEGER;
    case "position":
      return REAL;
    case "relation":
      // Single-target: stores the foreign id. Multi-target: array of ids → JSON.
      return meta.many ? JSON_TYPE : TEXT;
    // Structured / opaque values — always JSON.
    case "json":
    case "array":
    case "object":
    case "multiSelect":
    case "media":
    case "polymorphic":
    case "richText":
      return JSON_TYPE;
    default:
      // Unknown / third-party field — be conservative and store JSON.
      return JSON_TYPE;
  }
}

/**
 * System columns prepended to every table. `id` has no DB default — ULIDs are
 * minted by `Database.insert` so raw INSERTs from tools still work. Created /
 * updated timestamps keep DB-side defaults so test fixtures and ad-hoc inserts
 * don't need to thread them through.
 */
function systemColumns(): ReadonlyArray<ColumnSchema> {
  return [
    {
      name: "id",
      fieldName: "id",
      type: TEXT,
      notNull: true,
      primaryKey: true,
    },
    {
      name: "created_at",
      fieldName: "createdAt",
      type: DATETIME,
      notNull: true,
      defaultExpr: {
        sqlite: "(unixepoch() * 1000)",
        postgres: "now()",
      },
    },
    {
      name: "updated_at",
      fieldName: "updatedAt",
      type: DATETIME,
      notNull: true,
      defaultExpr: {
        sqlite: "(unixepoch() * 1000)",
        postgres: "now()",
      },
    },
    {
      name: "deleted_at",
      fieldName: "deletedAt",
      type: DATETIME,
      notNull: false,
    },
  ];
}

function buildTable(
  slug: string,
  fields: FieldsMap,
  options: { singletonId?: string },
): TableSchema {
  const columns: ColumnSchema[] = [...systemColumns()];
  const indexes: IndexSchema[] = [];
  // Seed the seen set with system column names so a user `column: "id"`
  // (or `"created_at"`, etc.) is rejected the same way two user fields
  // colliding would be.
  const seen = new Map<string, string>();
  for (const col of columns) seen.set(col.name, col.fieldName);

  for (const [fieldName, field] of Object.entries(fields)) {
    const meta = readMeta(field);
    // `id` is owned by the system column; user-declared `id` fields are
    // intentionally ignored at the DDL layer (the field still drives runtime
    // validation).
    if (fieldName === "id") continue;

    const name = meta.column ?? toColumnName(fieldName);
    const prior = seen.get(name);
    if (prior !== undefined) {
      throw new Error(
        `Column name collision in "${slug}": field "${fieldName}" maps to "${name}", already used by "${prior}".`,
      );
    }
    seen.set(name, fieldName);
    columns.push({
      name,
      fieldName,
      type: columnTypeFor(meta),
      notNull: meta.required === true,
    });

    if (meta.unique === true) {
      indexes.push({
        name: `${slug}_${name}_unique_idx`,
        table: slug,
        columns: [name],
        unique: true,
      });
    }
  }

  return {
    name: slug,
    columns,
    indexes,
    singletonCheck: options.singletonId ? { id: options.singletonId } : undefined,
  };
}

/**
 * Walks the normalized config and emits one TableSchema per collection +
 * singleton. Collection slugs and singleton slugs are assumed disjoint —
 * `defineConfig` doesn't enforce that yet, but a collision would also crash
 * the runtime resolver, so DDL doesn't need to defend against it.
 */
export function deriveSchema(config: NormalizedConfig): ReadonlyArray<TableSchema> {
  // `NormalizedConfig` narrows collections/singletons with a mapped type whose
  // values erase to `unknown` under `Object.entries`; re-view them as the
  // field-bearing shape the deriver actually reads.
  const collections = config.collections as Record<string, { fields: FieldsMap }>;
  const singletons = config.singletons as Record<string, { fields: FieldsMap }>;

  const tables: TableSchema[] = [];
  for (const [slug, collection] of Object.entries(collections)) {
    tables.push(buildTable(slug, collection.fields, {}));
  }
  for (const [slug, singleton] of Object.entries(singletons)) {
    tables.push(buildTable(slug, singleton.fields, { singletonId: slug }));
  }
  return tables;
}
