// End-to-end coverage for `BaseFieldOpts.column`: the override flows from
// the field constructor through `deriveSchema` to the rendered SQL.

import { describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { deriveSchema } from "./derive-schema";
import { generateDDL } from "./generate-ddl";

const buildConfig = () =>
  defineConfig({
    branding: { name: "Acme" },
    collections: {
      things: defineCollection({
        slug: "things",
        fields: {
          // camelCase that would naturally become `external_ref`.
          externalRef: fields.string({ column: "ext_ref", unique: true }),
          // snake_case override that doesn't follow toColumnName.
          sortKey: fields.number({ column: "rank" }),
        },
      }),
    },
  });

describe("custom column names", () => {
  it("uses the override as the column name in the TableSchema", () => {
    const [table] = deriveSchema(buildConfig());
    const names = table?.columns.map((c) => c.name) ?? [];
    expect(names).toContain("ext_ref");
    expect(names).toContain("rank");
    expect(names).not.toContain("external_ref");
    expect(names).not.toContain("sort_key");
  });

  it("preserves the original camelCase fieldName for tooling", () => {
    const [table] = deriveSchema(buildConfig());
    const ext = table?.columns.find((c) => c.name === "ext_ref");
    expect(ext?.fieldName).toBe("externalRef");
  });

  it("uses the override in the unique index name and target column", () => {
    const [table] = deriveSchema(buildConfig());
    expect(table?.indexes).toEqual([
      {
        name: "things_ext_ref_unique_idx",
        table: "things",
        columns: ["ext_ref"],
        unique: true,
      },
    ]);
  });

  it("renders the override into the SQLite DDL", () => {
    const sql = generateDDL(deriveSchema(buildConfig()), "sqlite");
    expect(sql).toContain('"ext_ref" TEXT');
    expect(sql).toContain('"rank" REAL');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "things_ext_ref_unique_idx" ON "things" ("ext_ref");',
    );
    expect(sql).not.toContain('"external_ref"');
    expect(sql).not.toContain('"sort_key"');
  });

  it("renders the override into the Postgres DDL", () => {
    const sql = generateDDL(deriveSchema(buildConfig()), "postgres");
    expect(sql).toContain('"ext_ref" TEXT');
    expect(sql).toContain('"rank" DOUBLE PRECISION');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "things_ext_ref_unique_idx" ON "things" ("ext_ref");',
    );
  });
});
