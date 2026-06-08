import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { defineConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { applySqlite } from "./apply";
import { generateMigration } from "./generate";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title: fields.string({ min: 1, required: true }),
    published: fields.boolean({ defaultValue: false }),
  },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

const run = <A, E>(effect: Effect.Effect<A, E, BunContext.BunContext>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, BunContext.layer));

describe("migrator: generate → apply", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "voila-migrate-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("generate writes the next NNNN_name.sql file with the table DDL", async () => {
    const migrationsDir = join(dir, "migrations");
    const path = await run(
      generateMigration({ config, dir: migrationsDir, name: "init", dialect: "sqlite" }),
    );

    expect(path).toBe(join(migrationsDir, "0001_init.sql"));
    const ddl = readFileSync(path, "utf8");
    expect(ddl).toContain('CREATE TABLE "posts"');
    expect(ddl).toContain('"title" TEXT NOT NULL');
  });

  it("generate increments the id when a migration already exists", async () => {
    const migrationsDir = join(dir, "migrations");
    const path = await run(
      generateMigration({ config, dir: migrationsDir, name: "again", dialect: "sqlite" }),
    );
    expect(path).toBe(join(migrationsDir, "0002_again.sql"));
    // Clean up so the apply test starts from a single migration.
    rmSync(path);
  });

  it("apply runs pending migrations, records the journal, and is idempotent", async () => {
    const migrationsDir = join(dir, "migrations");
    const dbPath = join(dir, "local.db");
    const url = `file:${dbPath}`;

    const first = await run(applySqlite({ dir: migrationsDir, url }));
    expect(first).toEqual([[1, "init"]]);

    const db = new Database(dbPath);
    try {
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((r) => (r as { name: string }).name);
      expect(tables).toContain("posts");
      expect(tables).toContain("effect_sql_migrations");

      const cols = db
        .query("PRAGMA table_info(posts)")
        .all()
        .map((r) => (r as { name: string }).name);
      expect(cols).toEqual(["id", "created_at", "updated_at", "deleted_at", "title", "published"]);

      const journal = db.query("SELECT migration_id, name FROM effect_sql_migrations").all();
      expect(journal).toEqual([{ migration_id: 1, name: "init" }]);
    } finally {
      db.close();
    }

    const second = await run(applySqlite({ dir: migrationsDir, url }));
    expect(second).toEqual([]);
  });

  it("generate creates the migrations directory when missing", async () => {
    const nested = join(dir, "fresh", "migrations");
    await run(generateMigration({ config, dir: nested, name: "init", dialect: "sqlite" }));
    expect(readdirSync(nested)).toEqual(["0001_init.sql"]);
  });

  it("includeAuth appends the Better Auth tables for sqlite, and apply provisions them", async () => {
    const migrationsDir = join(dir, "auth");
    const dbPath = join(dir, "auth.db");
    const path = await run(
      generateMigration({
        config,
        dir: migrationsDir,
        name: "init",
        dialect: "sqlite",
        includeAuth: true,
      }),
    );
    const ddl = readFileSync(path, "utf8");
    expect(ddl).toContain('CREATE TABLE "posts"');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "user"');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "session"');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS "verification"');

    await run(applySqlite({ dir: migrationsDir, url: `file:${dbPath}` }));
    const db = new Database(dbPath);
    try {
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all()
        .map((r) => (r as { name: string }).name);
      expect(tables).toContain("posts");
      expect(tables).toEqual(
        expect.arrayContaining(["user", "session", "account", "verification"]),
      );
    } finally {
      db.close();
    }
  });

  it("includeAuth is a no-op for postgres (pg auth DDL is M2)", async () => {
    const migrationsDir = join(dir, "auth-pg");
    const path = await run(
      generateMigration({
        config,
        dir: migrationsDir,
        name: "init",
        dialect: "postgres",
        includeAuth: true,
      }),
    );
    const ddl = readFileSync(path, "utf8");
    expect(ddl).not.toContain('"verification"');
  });
});
