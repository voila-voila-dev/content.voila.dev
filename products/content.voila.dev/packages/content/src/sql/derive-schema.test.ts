import { describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, defineSingleton, fields } from "@voila/content";
import { allFieldsConfig } from "./all-fields.fixture";
import { deriveSchema } from "./derive-schema";

describe("deriveSchema", () => {
  it("prepends id/created_at/updated_at/deleted_at to every content table", () => {
    const tables = deriveSchema(allFieldsConfig);
    // Engine-owned system tables (voila_media here — the fixture has a media
    // field) define their own column shapes.
    const content = tables.filter((t) => t.system !== true);
    expect(content.length).toBeGreaterThan(0);
    for (const table of content) {
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

describe("voila_media", () => {
  it("ships the media table when a collection declares a media field", () => {
    const tables = deriveSchema(allFieldsConfig);
    const media = tables.find((t) => t.name === "voila_media");
    expect(media).toBeDefined();
    expect(media?.system).toBe(true);
    expect(media?.columns.map((c) => c.name)).toEqual([
      "id",
      "key",
      "filename",
      "mime",
      "size",
      "width",
      "height",
      "alt",
      "created_at",
    ]);
    expect(media?.indexes[0]).toEqual({
      name: "voila_media_key_unique_idx",
      table: "voila_media",
      columns: ["key"],
      unique: true,
    });
  });

  it("ships it when only a singleton declares a media field", () => {
    const profile = defineSingleton({
      slug: "profile",
      fields: { avatar: fields.media() },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: {},
      singletons: { profile },
    });
    expect(deriveSchema(config).some((t) => t.name === "voila_media")).toBe(true);
  });

  it("stays out of media-free schemas", () => {
    const collection = defineCollection({
      slug: "things",
      fields: { name: fields.string() },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    expect(deriveSchema(config).some((t) => t.name === "voila_media")).toBe(false);
  });
});

describe("voila_search", () => {
  const searchable = defineCollection({
    slug: "articles",
    search: true,
    fields: { title: fields.string({ required: true }) },
  });

  it("ships an FTS table when a collection opts into search", () => {
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { articles: searchable },
    });
    const search = deriveSchema(config).find((t) => t.name === "voila_search");
    expect(search?.system).toBe(true);
    expect(search?.fts).toEqual({
      module: "fts5",
      content: "content",
      unindexed: ["collection", "doc_id"],
    });
    expect(search?.columns.map((c) => c.name)).toEqual(["collection", "doc_id", "content"]);
    // The index is the Postgres-only GIN expression index (skipped on SQLite).
    expect(search?.indexes[0]?.using).toBe("gin");
  });

  it("ships it for an explicit (non-empty) field list", () => {
    const collection = defineCollection({
      slug: "things",
      search: ["name"],
      fields: { name: fields.string() },
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      collections: { things: collection },
    });
    expect(deriveSchema(config).some((t) => t.name === "voila_search")).toBe(true);
  });

  it("stays out of schemas with no (or empty) search opt-in", () => {
    const off = defineCollection({ slug: "a", fields: { name: fields.string() } });
    const empty = defineCollection({ slug: "b", search: [], fields: { name: fields.string() } });
    const config = defineConfig({ branding: { name: "Acme" }, collections: { off, empty } });
    expect(deriveSchema(config).some((t) => t.name === "voila_search")).toBe(false);
  });
});
