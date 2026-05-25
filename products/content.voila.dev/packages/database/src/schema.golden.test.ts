/**
 * Golden-file tests for the schema → Drizzle generator (roadmap M1 testing
 * bar). For every field type and modifier we lock the column the generator
 * emits — its SQL type, nullability, uniqueness, primary-key flag, and whether
 * it carries a DB-level default — for both the SQLite and Postgres dialects.
 *
 * The golden text is a deterministic, DDL-shaped rendering of
 * `schemaToTables(...)`. A field-type → column-type regression (e.g. a
 * `datetime` silently switching from a timestamp to text) shows up as a diff
 * against the committed `__golden__/*.sql` files.
 *
 * Regenerate after an intentional change:
 *   UPDATE_GOLDENS=1 bun test src/schema.golden.test.ts
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fields } from "@voila/content-schema";
import { getTableConfig as pgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as sqliteTableConfig } from "drizzle-orm/sqlite-core";
import { type CollectionLike, type GeneratedTables, schemaToTables } from "./schema/index.ts";
import type { DatabaseDialect } from "./types.ts";

const GOLDEN_DIR = join(import.meta.dir, "__golden__");

// One column per field type, plus the `required` / `unique` modifiers, so the
// golden enumerates every mapping the generator can produce.
const allFields: CollectionLike = {
  kind: "collection",
  slug: "all_fields",
  fields: {
    str: fields.string(),
    strRequired: fields.string({ required: true }),
    strUnique: fields.string({ unique: true }),
    num: fields.number(),
    int: fields.number({ integer: true }),
    flag: fields.boolean(),
    day: fields.date(),
    moment: fields.datetime(),
    payload: fields.json(),
  },
};

// A singleton, to lock the system columns + the `<id> = '<slug>'` CHECK.
const site: CollectionLike = {
  kind: "singleton",
  slug: "site",
  fields: { title: fields.string({ required: true }) },
};

interface RenderableColumn {
  readonly name: string;
  readonly notNull: boolean;
  readonly primary: boolean;
  readonly isUnique: boolean;
  readonly hasDefault: boolean;
  getSQLType(): string;
}

function renderColumn(col: RenderableColumn): string {
  const parts = [`"${col.name}"`, col.getSQLType()];
  if (col.primary) parts.push("PRIMARY KEY");
  if (col.notNull) parts.push("NOT NULL");
  if (col.isUnique) parts.push("UNIQUE");
  // The exact default expression (UUID generator, unixepoch) is a dialect
  // detail; locking its *presence* is enough to catch a dropped default.
  if (col.hasDefault) parts.push("DEFAULT");
  return `  ${parts.join(" ")}`;
}

/**
 * Pull the column + check list out of a generated table. `getTableConfig` is
 * dialect-specific, so we branch on the dialect and call the matching one with
 * a concrete type (storing both in one variable would union two incompatible
 * call signatures). The shared `{ columns, checks }` shape is all we render.
 */
function configFor(dialect: DatabaseDialect, slug: string, tables: GeneratedTables) {
  const cfg = dialect === "sqlite" ? sqliteTableConfig(tables[slug]) : pgTableConfig(tables[slug]);
  return {
    columns: cfg.columns as readonly RenderableColumn[],
    checks: cfg.checks as readonly { name: string }[],
  };
}

function renderDialect(dialect: DatabaseDialect): string {
  const tables = schemaToTables([allFields, site], { dialect });
  const blocks: string[] = [];
  for (const slug of Object.keys(tables)) {
    const { columns, checks } = configFor(dialect, slug, tables);
    const cols = columns.map(renderColumn);
    const checkLines = checks.map((c) => `  CHECK ${c.name}`);
    blocks.push(`TABLE "${slug}" (\n${[...cols, ...checkLines].join("\n")}\n)`);
  }
  return `${blocks.join("\n\n")}\n`;
}

describe("schema → Drizzle generator golden files", () => {
  for (const dialect of ["sqlite", "postgres"] as const) {
    test(`${dialect} columns match the golden file`, () => {
      const actual = renderDialect(dialect);
      const goldenPath = join(GOLDEN_DIR, `schema.${dialect}.sql`);

      if (process.env.UPDATE_GOLDENS) {
        writeFileSync(goldenPath, actual);
        return;
      }

      const expected = readFileSync(goldenPath, "utf8");
      expect(actual).toBe(expected);
    });
  }
});
