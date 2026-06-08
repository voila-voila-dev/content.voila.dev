// Golden-file tests for generateDDL. Set `UPDATE_GOLDENS=1` to regenerate
// (and review the diff before committing).

import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
// The all-fields fixture and `deriveSchema` now live in `@voila/content` (the
// schema-descriptor core, shared with the runtime `Database`). This goldens test
// owns DDL *rendering* (`generateDDL`) and reaches the single shared fixture by
// its workspace path so there's no duplicate "every field kind" config to drift.
import { type Dialect, deriveSchema } from "@voila/content/sql";
import { allFieldsConfig } from "../../../../content/src/sql/all-fields.fixture";
import { generateDDL } from "./generate-ddl";

const GOLDEN_DIR = join(import.meta.dir, "__golden__");
const SHOULD_UPDATE = process.env.UPDATE_GOLDENS === "1";

const goldenPath = (dialect: Dialect) => join(GOLDEN_DIR, `all-fields.${dialect}.sql`);

const assertGolden = (dialect: Dialect, actual: string): void => {
  const path = goldenPath(dialect);
  if (SHOULD_UPDATE) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, actual);
    return;
  }
  const expected = readFileSync(path, "utf8");
  expect(actual).toBe(expected);
};

describe("generateDDL (goldens)", () => {
  const tables = deriveSchema(allFieldsConfig);

  it("matches the sqlite golden", () => {
    assertGolden("sqlite", generateDDL(tables, "sqlite"));
  });

  it("matches the postgres golden", () => {
    assertGolden("postgres", generateDDL(tables, "postgres"));
  });
});
