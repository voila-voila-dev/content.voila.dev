// Golden-file specs for `generateDDL` — the M1 testing-bar item "schema→DDL
// generator — golden files per field type (ported)".
//
// Fixture covers every built-in field kind plus the `required` / `unique` /
// `index` modifiers and one singleton (to lock the CHECK clause). A
// field-type → SQL-type regression (e.g. `datetime` silently switching from
// `integer` to `text` in sqlite) shows up as a diff against `__golden__/*.sql`.
//
// Regenerate after an intentional change:
//   UPDATE_GOLDENS=1 bun test src/ddl/generate-ddl.test.ts

import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { boolean, date, datetime, json, number, select, slug, string } from "@voila/content-schema";
import { deriveSchema } from "./derive-schema.ts";
import { generateDDL } from "./generate-ddl.ts";
import type { CollectionConfig, Dialect } from "./types.ts";

const GOLDEN_DIR = join(import.meta.dir, "__golden__");

const fixtures: ReadonlyArray<CollectionConfig> = [
  {
    kind: "collection",
    slug: "all_fields",
    fields: {
      str: string(),
      strRequired: string({ required: true }),
      strUnique: string({ unique: true }),
      num: number(),
      int: number({ integer: true }),
      flag: boolean(),
      day: date(),
      moment: datetime(),
      payload: json(),
      status: select({ options: ["draft", "published"] }),
      path: slug({ unique: true }),
      // `index: true` (without unique) lights the CREATE INDEX path.
      score: number({ integer: true, index: true }),
    },
  },
  {
    kind: "singleton",
    slug: "site",
    fields: { title: string({ required: true }) },
  },
];

describe("generateDDL — golden files", () => {
  for (const dialect of ["sqlite", "postgres"] as const satisfies readonly Dialect[]) {
    test(`${dialect} script matches golden`, () => {
      const tables = deriveSchema(fixtures);
      const actual = generateDDL(tables, dialect);
      const goldenPath = join(GOLDEN_DIR, `all-fields.${dialect}.sql`);

      if (process.env.UPDATE_GOLDENS) {
        writeFileSync(goldenPath, actual);
        return;
      }

      const expected = readFileSync(goldenPath, "utf8");
      expect(actual).toBe(expected);
    });
  }
});
