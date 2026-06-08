import { describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { allFieldsConfig } from "./all-fields.fixture";
import { deriveSchema } from "./derive-schema";

describe("deriveSchema", () => {
  it("prepends id/created_at/updated_at/deleted_at to every table", () => {
    const tables = deriveSchema(allFieldsConfig);
    for (const table of tables) {
      const head = table.columns.slice(0, 4).map((c) => c.name);
      expect(head).toEqual(["id", "created_at", "updated_at", "deleted_at"]);
    }
  });

  it("maps localized fields to JSON regardless of the underlying kind", () => {
    const tables = deriveSchema(allFieldsConfig);
    const everything = tables.find((t) => t.name === "everything");
    const localized = everything?.columns.find((c) => c.fieldName === "titleLocalized");
    expect(localized?.type).toEqual({ sqlite: "TEXT", postgres: "JSONB" });
  });

  it("renders integer numbers as INTEGER/BIGINT and floats as REAL/DOUBLE PRECISION", () => {
    const tables = deriveSchema(allFieldsConfig);
    const cols = tables.find((t) => t.name === "everything")?.columns ?? [];
    expect(cols.find((c) => c.fieldName === "count")?.type).toEqual({
      sqlite: "INTEGER",
      postgres: "BIGINT",
    });
    expect(cols.find((c) => c.fieldName === "weight")?.type).toEqual({
      sqlite: "REAL",
      postgres: "DOUBLE PRECISION",
    });
  });

  it("converts camelCase field names to snake_case columns", () => {
    const tables = deriveSchema(allFieldsConfig);
    const names = tables.find((t) => t.name === "everything")?.columns.map((c) => c.name) ?? [];
    expect(names).toContain("is_published");
    expect(names).toContain("primary_color");
    expect(names).toContain("author_id");
  });

  it("emits a CHECK constraint marker on singleton tables", () => {
    const tables = deriveSchema(allFieldsConfig);
    const settings = tables.find((t) => t.name === "settings");
    expect(settings?.singletonCheck).toEqual({ id: "settings" });
    const everything = tables.find((t) => t.name === "everything");
    expect(everything?.singletonCheck).toBeUndefined();
  });

  it("emits a unique index per unique-flagged field", () => {
    const tables = deriveSchema(allFieldsConfig);
    const everything = tables.find((t) => t.name === "everything");
    // `slug` defaults to `unique: true`.
    const slugIdx = everything?.indexes.find((i) => i.columns[0] === "slug");
    expect(slugIdx?.unique).toBe(true);
  });

  it("treats single relations as text id columns and many-relations as JSON", () => {
    const tables = deriveSchema(allFieldsConfig);
    const cols = tables.find((t) => t.name === "everything")?.columns ?? [];
    expect(cols.find((c) => c.fieldName === "authorId")?.type).toEqual({
      sqlite: "TEXT",
      postgres: "TEXT",
    });
    expect(cols.find((c) => c.fieldName === "contributors")?.type).toEqual({
      sqlite: "TEXT",
      postgres: "JSONB",
    });
  });

  it("flags NOT NULL only when the field is required", () => {
    const tables = deriveSchema(allFieldsConfig);
    const cols = tables.find((t) => t.name === "everything")?.columns ?? [];
    expect(cols.find((c) => c.fieldName === "title")?.notNull).toBe(true);
    expect(cols.find((c) => c.fieldName === "weight")?.notNull).toBe(false);
  });

  it("skips a user-declared `id` field — the system column owns it", () => {
    const collection = defineCollection({
      slug: "things",
      fields: {
        id: fields.id(),
        name: fields.string(),
      },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    const tables = deriveSchema(config);
    const ids = tables[0]?.columns.filter((c) => c.fieldName === "id") ?? [];
    expect(ids.length).toBe(1);
    expect(ids[0]?.primaryKey).toBe(true);
  });

  it("honors the `column` override and uses it for the unique index name", () => {
    const collection = defineCollection({
      slug: "things",
      fields: {
        externalRef: fields.string({ column: "ext_ref", unique: true }),
      },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    const table = deriveSchema(config)[0];
    expect(table?.columns.find((c) => c.fieldName === "externalRef")?.name).toBe("ext_ref");
    expect(table?.indexes[0]).toEqual({
      name: "things_ext_ref_unique_idx",
      table: "things",
      columns: ["ext_ref"],
      unique: true,
    });
  });

  it("throws when two fields would map to the same column", () => {
    const collection = defineCollection({
      slug: "things",
      fields: {
        first: fields.string({ column: "name" }),
        second: fields.string({ column: "name" }),
      },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    expect(() => deriveSchema(config)).toThrow(/collision in "things".*"second".*"name".*"first"/);
  });

  it("throws when an override collides with a system column", () => {
    const collection = defineCollection({
      slug: "things",
      fields: {
        ownerId: fields.string({ column: "created_at" }),
      },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    expect(() => deriveSchema(config)).toThrow(/created_at.*createdAt/);
  });

  it("throws when the natural snake_case collides with a sibling's override", () => {
    const collection = defineCollection({
      slug: "things",
      fields: {
        nickName: fields.string(),
        handle: fields.string({ column: "nick_name" }),
      },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    expect(() => deriveSchema(config)).toThrow(/nick_name/);
  });
});
