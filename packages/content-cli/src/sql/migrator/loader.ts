// Reads plain `NNNN_name.sql` migration files. The same files are consumed by
// Wrangler's `d1 migrations apply` for the D1 targets — so SQLite (via the
// `voila_migrations` journal) and D1 (via Wrangler's `d1_migrations` table) run
// identical artifacts.
//
// Filenames follow `/^(\d+)_(.+)\.sql$/`: a numeric id prefix (the journal's
// `id`) and a snake/kebab name. Ids sort numerically, not lexically.

import { readdir, readFile } from "node:fs/promises";

const FILENAME = /^(\d+)_(.+)\.sql$/;

export interface ParsedMigration {
  readonly id: number;
  readonly name: string;
  readonly file: string;
}

export interface LoadedMigration extends ParsedMigration {
  readonly statements: ReadonlyArray<string>;
}

/** Parse a migration filename into `{ id, name, file }`, or `null` if it doesn't match. */
export function parseMigrationFile(file: string): ParsedMigration | null {
  const match = file.match(FILENAME);
  if (match === null) return null;
  const [, id, name] = match;
  return { id: Number(id), name: name as string, file };
}

/** The next zero-padded `NNNN` id given the migration files already on disk. */
export function nextMigrationId(files: ReadonlyArray<string>): number {
  let max = 0;
  for (const file of files) {
    const parsed = parseMigrationFile(file);
    if (parsed !== null && parsed.id > max) max = parsed.id;
  }
  return max + 1;
}

/** Zero-pad a migration id to the 4-digit `NNNN` prefix. */
export function formatMigrationId(id: number): string {
  return String(id).padStart(4, "0");
}

/**
 * Split a `.sql` file into individual statements. Generated DDL terminates each
 * statement with `;`; we split on it and drop blank fragments so each statement
 * runs as its own prepared query (`bun:sqlite` rejects multi-statement strings).
 */
export function splitStatements(sql: string): ReadonlyArray<string> {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Read every `NNNN_name.sql` file in `directory`, parse and sort by id, and
 * split each into its statements. Non-migration files are ignored.
 */
export async function loadMigrations(directory: string): Promise<ReadonlyArray<LoadedMigration>> {
  const files = await readdir(directory);
  const parsed = files
    .map(parseMigrationFile)
    .filter((p): p is ParsedMigration => p !== null)
    .sort((a, b) => a.id - b.id);

  const loaded: LoadedMigration[] = [];
  for (const migration of parsed) {
    const contents = await readFile(`${directory}/${migration.file}`, "utf8");
    loaded.push({ ...migration, statements: splitStatements(contents) });
  }
  return loaded;
}
