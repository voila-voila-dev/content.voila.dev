// Golden-file tests for generateDDL. Set `UPDATE_GOLDENS=1` to regenerate
// (and review the diff before committing).

import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
// The all-fields fixture and `deriveSchema` now live in `@voila/content` (the
// schema-descriptor core, shared with the runtime `Database`). This goldens test
// owns DDL *rendering* (`generateDDL`) and reaches the single shared fixture by
// its workspace path so there's no duplicate "every field kind" config to drift.
import { defineCollection, defineConfig, fields } from "@voila/content";
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

describe("generateDDL — full-text search", () => {
  const config = defineConfig({
    branding: { name: "Acme" },
    collections: {
      articles: defineCollection({
        slug: "articles",
        search: true,
        fields: { title: fields.string({ required: true }) },
      }),
    },
  });
  const search = deriveSchema(config).filter((t) => t.name === "voila_search");

  it("renders an FTS5 virtual table on SQLite (no separate index)", () => {
    const sql = generateDDL(search, "sqlite");
    expect(sql).toContain(
      'CREATE VIRTUAL TABLE "voila_search" USING fts5(collection UNINDEXED, doc_id UNINDEXED, content);',
    );
    expect(sql).not.toContain("CREATE INDEX");
  });

  it("renders a table + GIN expression index on Postgres", () => {
    const sql = generateDDL(search, "postgres");
    expect(sql).toContain('CREATE TABLE "voila_search"');
    expect(sql).toContain(
      `CREATE INDEX "voila_search_content_idx" ON "voila_search" USING gin (to_tsvector('simple', "content"));`,
    );
    expect(sql).not.toContain("VIRTUAL TABLE");
  });
});
