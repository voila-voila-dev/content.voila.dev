// `Database.search` over real (in-memory) SQLite FTS5: the engine keeps the
// `voila_search` index in sync on every write, ranks matches by bm25, and loads
// the real rows through the normal read scoping (soft-delete + draft status).
// The schema is rendered from the descriptor (`deriveSchema`) — including the
// FTS5 virtual table — so the test stays inside `@voila/content`.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";

const articles = defineCollection({
  slug: "articles",
  search: true,
  fields: {
    title: fields.string({ required: true }),
    body: fields.markdown(),
    name: fields.string({ localized: true }),
  },
});

const posts = defineCollection({
  slug: "posts",
  search: true,
  drafts: true,
  fields: { title: fields.string({ required: true }) },
});

// No `search` — exercises the not-search-enabled guard.
const notes = defineCollection({
  slug: "notes",
  fields: { title: fields.string({ required: true }) },
});

const config = defineConfig({
  branding: { name: "Test" },
  i18n: { locales: ["en", "fr"], defaultLocale: "en" },
  collections: { articles, posts, notes },
});

// Render CREATE statements from the descriptor, including the FTS5 virtual table.
function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    if (table.fts) {
      const unindexed = new Set(table.fts.unindexed);
      const cols = table.columns.map((c) =>
        unindexed.has(c.name) ? `${c.name} UNINDEXED` : c.name,
      );
      stmts.push(`CREATE VIRTUAL TABLE "${table.name}" USING fts5(${cols.join(", ")})`);
      continue; // FTS5 self-indexes; skip the (Postgres-only) GIN index row.
    }
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      if (c.defaultExpr?.sqlite) parts.push(`DEFAULT ${c.defaultExpr.sqlite}`);
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
    for (const idx of table.indexes) {
      const cols2 = idx.columns.map((c) => `"${c}"`).join(", ");
      stmts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX "${idx.name}" ON "${idx.table}" (${cols2})`,
      );
    }
  }
  return stmts;
}

let driver: SqliteDriver;
let db: ReturnType<typeof makeDatabase>;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  db = makeDatabase(config, driver);
});

const titles = (result: { documents: ReadonlyArray<{ title?: unknown }> }): Array<unknown> =>
  result.documents.map((d) => d.title);

describe("Database.search", () => {
  it("indexes on create and finds matching rows", async () => {
    await db.create("articles", { title: "The quick brown fox", body: "" });
    await db.create("articles", { title: "Lazy dogs sleep", body: "" });
    const result = await db.search("articles", "fox");
    expect(titles(result)).toEqual(["The quick brown fox"]);
  });

  it("prefix-matches each token", async () => {
    await db.create("articles", { title: "Strawberry fields", body: "" });
    const result = await db.search("articles", "straw");
    expect(titles(result)).toEqual(["Strawberry fields"]);
  });

  it("searches across all indexed fields, including rich body text", async () => {
    await db.create("articles", { title: "Untitled", body: "a note about kangaroos" });
    const result = await db.search("articles", "kangaroo");
    expect(titles(result)).toEqual(["Untitled"]);
  });

  it("returns no results for a blank query", async () => {
    await db.create("articles", { title: "Anything", body: "" });
    expect((await db.search("articles", "   ")).documents).toEqual([]);
  });

  it("re-indexes on update — the old term stops matching", async () => {
    const row = await db.create("articles", { title: "Penguins", body: "" });
    await db.update("articles", String(row.id), { title: "Walruses", body: "" });
    expect((await db.search("articles", "penguin")).documents).toEqual([]);
    expect(titles(await db.search("articles", "walrus"))).toEqual(["Walruses"]);
  });

  it("drops a soft-deleted row, and re-indexes it on restore", async () => {
    const row = await db.create("articles", { title: "Ephemeral", body: "" });
    await db.softDelete("articles", String(row.id));
    expect((await db.search("articles", "ephemeral")).documents).toEqual([]);
    await db.restore("articles", String(row.id));
    expect(titles(await db.search("articles", "ephemeral"))).toEqual(["Ephemeral"]);
  });

  it("drops a hard-deleted row from the index", async () => {
    const row = await db.create("articles", { title: "Doomed", body: "" });
    await db.hardDelete("articles", String(row.id));
    expect((await db.search("articles", "doomed")).documents).toEqual([]);
  });

  it("indexes every locale of a localized field", async () => {
    await db.create("articles", { title: "x", body: "", name: { en: "elephant", fr: "éléphant" } });
    expect(titles(await db.search("articles", "elephant"))).toHaveLength(1);
    expect(titles(await db.search("articles", "éléphant"))).toHaveLength(1);
  });

  it("scopes to published rows by default, but honours status: any", async () => {
    const draft = await db.create("posts", { title: "Hidden gem" });
    // Drafts are unpublished on create → excluded from the default (published) scope.
    expect((await db.search("posts", "gem")).documents).toEqual([]);
    expect(titles(await db.search("posts", "gem", { status: "any" }))).toEqual(["Hidden gem"]);
    await db.publish("posts", String(draft.id));
    expect(titles(await db.search("posts", "gem"))).toEqual(["Hidden gem"]);
  });

  it("throws for a collection that isn't search-enabled", async () => {
    await expect(db.search("notes", "anything")).rejects.toBeInstanceOf(DatabaseError);
  });
});
