// Snapshot coverage for the migrator, exercised against the comprehensive
// `allFieldsConfig` (every field kind + a singleton). Three guarantees:
//   1. `generate` writes the expected `.sql` for sqlite and postgres.
//   2. `apply` actually runs that sqlite DDL — snapshotting the schema SQLite
//      itself reports back (`sqlite_master`) proves the statements execute and
//      the singleton CHECK survives a real round-trip, which the DDL goldens
//      (compared as text, never run) can't.
//   3. The Migrator journal records the applied migration.
//
// Update snapshots with `bun test --update-snapshots` after an intentional
// schema change.

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// The all-fields fixture lives in `@voila/content` (shared schema-descriptor
// core); reached by its workspace path so there's a single "every field kind" config.
import { allFieldsConfig } from "../../../../content/src/sql/all-fields.fixture";
import { applySqlite } from "./apply";
import { generateMigration } from "./generate";

describe("migrator snapshots (all field types)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "voila-migrate-snap-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("generates the expected sqlite migration file", async () => {
    const migrationsDir = join(dir, "sqlite");
    const path = await generateMigration({
      config: allFieldsConfig,
      dir: migrationsDir,
      name: "init",
      dialect: "sqlite",
    });
    expect(readFileSync(path, "utf8")).toMatchSnapshot();
  });

  it("generates the expected postgres migration file", async () => {
    const migrationsDir = join(dir, "postgres");
    const path = await generateMigration({
      config: allFieldsConfig,
      dir: migrationsDir,
      name: "init",
      dialect: "postgres",
    });
    expect(readFileSync(path, "utf8")).toMatchSnapshot();
  });

  it("applies the sqlite migration and produces the expected physical schema", async () => {
    const migrationsDir = join(dir, "sqlite-apply");
    const dbPath = join(dir, "snap.db");
    await generateMigration({
      config: allFieldsConfig,
      dir: migrationsDir,
      name: "init",
      dialect: "sqlite",
    });

    const applied = await applySqlite({ dir: migrationsDir, url: `file:${dbPath}` });
    expect(applied).toEqual([[1, "init"]]);

    const db = new Database(dbPath);
    try {
      // The DDL SQLite actually stored, for our tables/indexes (excludes the
      // Migrator's own journal table and SQLite's internal autoindexes).
      const schema = db
        .query(
          `SELECT sql FROM sqlite_master
           WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name != 'voila_migrations'
           ORDER BY type DESC, name`,
        )
        .all()
        .map((r) => (r as { sql: string }).sql)
        .join("\n\n");
      expect(schema).toMatchSnapshot();

      const journal = db.query("SELECT id, name FROM voila_migrations").all();
      expect(journal).toEqual([{ id: 1, name: "init" }]);
    } finally {
      db.close();
    }
  });
});
