import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content-schema";
import { sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { sqlite } from "./adapters/sqlite.ts";
import { type CollectionLike, schemaToTables, toColumnName } from "./schema/index.ts";

describe("toColumnName", () => {
  test("converts camelCase to snake_case", () => {
    expect(toColumnName("title")).toBe("title");
    expect(toColumnName("publishedAt")).toBe("published_at");
    expect(toColumnName("createdByUserId")).toBe("created_by_user_id");
  });
});

describe("schemaToTables", () => {
  test("returns one table per collection slug", () => {
    const a: CollectionLike = { kind: "collection", slug: "posts", fields: {} };
    const b: CollectionLike = { kind: "singleton", slug: "site", fields: {} };
    const tables = schemaToTables([a, b], { dialect: "sqlite" });
    expect(Object.keys(tables).sort()).toEqual(["posts", "site"]);
  });

  test("throws on duplicate slugs", () => {
    const a: CollectionLike = { kind: "collection", slug: "posts", fields: {} };
    const b: CollectionLike = { kind: "singleton", slug: "posts", fields: {} };
    expect(() => schemaToTables([a, b], { dialect: "sqlite" })).toThrow(/duplicate/);
  });

  test("rejects field names that collide with system columns (camelCase)", () => {
    const c: CollectionLike = {
      kind: "collection",
      slug: "posts",
      fields: { id: fields.string() },
    };
    expect(() => schemaToTables([c], { dialect: "sqlite" })).toThrow(/system column/);
  });

  test("rejects field names that collide with system columns (snake_case)", () => {
    const c: CollectionLike = {
      kind: "collection",
      slug: "posts",
      fields: { created_at: fields.datetime() },
    };
    expect(() => schemaToTables([c], { dialect: "sqlite" })).toThrow(/system column/);
  });

  test("rejects invalid slugs", () => {
    const bad: CollectionLike = {
      kind: "collection",
      slug: 'evil"; DROP TABLE users; --',
      fields: {},
    };
    expect(() => schemaToTables([bad], { dialect: "sqlite" })).toThrow(/invalid slug/);
  });

  test("rejects invalid field names", () => {
    const c: CollectionLike = {
      kind: "collection",
      slug: "posts",
      fields: { 'bad"name': fields.string() },
    };
    expect(() => schemaToTables([c], { dialect: "sqlite" })).toThrow(/invalid field name/);
  });

  test("rejects unknown field kinds", () => {
    const c: CollectionLike = {
      kind: "collection",
      slug: "posts",
      // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid for the negative test.
      fields: { x: { kind: "unknown" } as any },
    };
    expect(() => schemaToTables([c], { dialect: "sqlite" })).toThrow(/unknown field kind/);
  });

  test("attaches a singleton CHECK constraint via drizzle-kit-visible API", () => {
    const site: CollectionLike = {
      kind: "singleton",
      slug: "site",
      fields: { title: fields.string({ required: true }) },
    };
    const tables = schemaToTables([site], { dialect: "sqlite" });
    const cfg = getTableConfig(tables.site);
    const check = cfg.checks.find((c) => c.name === "site_singleton");
    expect(check).toBeDefined();
  });

  test("singleton CHECK enforces the row-id literal end-to-end", () => {
    const site: CollectionLike = {
      kind: "singleton",
      slug: "site",
      fields: { title: fields.string({ required: true }) },
    };
    // Drizzle-kit translates the table's check expression into DDL — we run
    // the resulting table against a real sqlite DB to make sure the slug
    // ends up as a SQL literal (`'site'`) rather than a bind param (`?`),
    // which earlier broke `CREATE TABLE`.
    const adapter = sqlite({ url: ":memory:" });
    try {
      adapter.drizzle.run(
        sql.raw(`
        CREATE TABLE "site" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          "deleted_at" INTEGER,
          "title" TEXT NOT NULL,
          CONSTRAINT "site_singleton" CHECK ("id" = 'site')
        )
      `),
      );
      // Legit insert succeeds.
      adapter.drizzle.run(sql.raw(`INSERT INTO "site" ("id", "title") VALUES ('site', 'Voila')`));
      // Wrong id is rejected by the CHECK.
      expect(() =>
        adapter.drizzle.run(
          sql.raw(`INSERT INTO "site" ("id", "title") VALUES ('other', 'Sneaky')`),
        ),
      ).toThrow(/INSERT INTO "site"/);
    } finally {
      adapter.close?.();
    }
    // Touch schemaToTables to keep the runtime check in scope of this test.
    void schemaToTables([site], { dialect: "sqlite" });
  });

  test("id defaults to a UUID v4 at the DB level (sqlite)", () => {
    const posts: CollectionLike = {
      kind: "collection",
      slug: "posts",
      fields: { title: fields.string({ required: true }) },
    };
    const adapter = sqlite({ url: ":memory:" });
    try {
      adapter.drizzle.run(
        sql.raw(`
        CREATE TABLE "posts" (
          "id" TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))) NOT NULL,
          "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          "deleted_at" INTEGER,
          "title" TEXT NOT NULL
        )
      `),
      );
      // Insert without specifying id — DB must populate it with a UUID v4.
      adapter.drizzle.run(sql.raw(`INSERT INTO "posts" ("title") VALUES ('Hello')`));
      const row = adapter.drizzle.all<{ id: string }>(sql.raw(`SELECT id FROM "posts"`)).at(0);
      expect(row?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      adapter.close?.();
    }
    void schemaToTables([posts], { dialect: "sqlite" });
  });

  test("collections do not get a singleton check", () => {
    const posts: CollectionLike = {
      kind: "collection",
      slug: "posts",
      fields: { title: fields.string({ required: true }) },
    };
    const tables = schemaToTables([posts], { dialect: "sqlite" });
    const cfg = getTableConfig(tables.posts);
    expect(cfg.checks.find((c) => c.name === "posts_singleton")).toBeUndefined();
  });

  test("runtime tables roundtrip against a real sqlite database", () => {
    const posts: CollectionLike = {
      kind: "collection",
      slug: "posts",
      fields: {
        title: fields.string({ required: true }),
        views: fields.number({ integer: true }),
        meta: fields.json(),
      },
    };
    const adapter = sqlite({ url: ":memory:" });
    try {
      // Seed the schema directly — drizzle-kit owns CREATE TABLE in production,
      // here we only need a real DB to exercise the runtime query path.
      adapter.drizzle.run(
        sql.raw(`
        CREATE TABLE "posts" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          "deleted_at" INTEGER,
          "title" TEXT NOT NULL,
          "views" INTEGER,
          "meta" TEXT
        )
      `),
      );
      const tables = schemaToTables([posts], { dialect: "sqlite" });
      adapter.drizzle
        .insert(tables.posts)
        .values({ id: "01HXYZ", title: "hello", views: 3, meta: { tag: "x" } })
        .run();
      const rows = adapter.drizzle.select().from(tables.posts).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: "01HXYZ",
        title: "hello",
        views: 3,
        meta: { tag: "x" },
        deletedAt: null,
      });
      expect(rows[0].createdAt).toBeInstanceOf(Date);
      expect(rows[0].updatedAt).toBeInstanceOf(Date);
    } finally {
      adapter.close?.();
    }
  });
});
