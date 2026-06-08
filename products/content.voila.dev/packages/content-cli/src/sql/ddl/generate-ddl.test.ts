// Golden-file tests for generateDDL. Set `UPDATE_GOLDENS=1` to regenerate
// (and review the diff before committing).

import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { allFieldsConfig } from "./all-fields.fixture";
import { deriveSchema } from "./derive-schema";
import { generateDDL } from "./generate-ddl";
import type { Dialect } from "./types";

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
