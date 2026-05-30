// A `@effect/sql/Migrator` loader that reads plain `NNNN_name.sql` files instead
// of `.ts`/`.js` migration modules. The same files are consumed by Wrangler's
// `d1 migrations apply` for the D1 targets — so SQLite (via the Migrator
// journal) and D1 (via Wrangler's `d1_migrations` table) run identical
// artifacts.
//
// Filenames mirror the convention `@effect/sql/Migrator/FileSystem` uses
// (`/^(\d+)_(.+)\.sql$/`): a numeric id prefix (the Migrator's `migration_id`)
// and a snake/kebab name. Ids sort numerically, not lexically.

import { FileSystem } from "@effect/platform/FileSystem";
import * as Migrator from "@effect/sql/Migrator";
import { SqlClient } from "@effect/sql/SqlClient";
import { Effect, Option } from "effect";

const FILENAME = /^(\d+)_(.+)\.sql$/;

export interface ParsedMigration {
  readonly id: number;
  readonly name: string;
  readonly file: string;
}

/** Parse a migration filename into `{ id, name }`, or `None` if it doesn't match. */
export const parseMigrationFile = (file: string): Option.Option<ParsedMigration> => {
  const match = file.match(FILENAME);
  if (match === null) return Option.none();
  const [, id, name] = match;
  return Option.some({ id: Number(id), name: name as string, file });
};

/** The next zero-padded `NNNN` id given the migration files already on disk. */
export const nextMigrationId = (files: ReadonlyArray<string>): number => {
  let max = 0;
  for (const file of files) {
    const parsed = parseMigrationFile(file);
    if (Option.isSome(parsed) && parsed.value.id > max) max = parsed.value.id;
  }
  return max + 1;
};

/** Zero-pad a migration id to the 4-digit `NNNN` prefix. */
export const formatMigrationId = (id: number): string => String(id).padStart(4, "0");

/**
 * Split a `.sql` file into individual statements. Generated DDL terminates each
 * statement with `;`; we split on it and drop blank fragments so each statement
 * runs as its own prepared query (`bun:sqlite` rejects multi-statement strings).
 */
export const splitStatements = (sql: string): ReadonlyArray<string> =>
  sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/**
 * A Migrator `Loader` over a directory of `NNNN_name.sql` files. File contents
 * are read eagerly (while the `FileSystem` is in scope) and baked into each
 * migration's `load` Effect, which only needs the `SqlClient` to run.
 */
export const fromSqlFiles = (directory: string): Migrator.Loader<FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem;
    const files = yield* fs.readDirectory(directory);
    const parsed = files
      .flatMap((file) =>
        Option.match(parseMigrationFile(file), { onNone: () => [], onSome: (p) => [p] }),
      )
      .sort((a, b) => a.id - b.id);

    return yield* Effect.forEach(parsed, (migration) =>
      fs.readFileString(`${directory}/${migration.file}`).pipe(
        Effect.map((contents): Migrator.ResolvedMigration => {
          const statements = splitStatements(contents);
          const run = Effect.gen(function* () {
            const sql = yield* SqlClient;
            for (const statement of statements) {
              yield* sql.unsafe(statement);
            }
          });
          // The Migrator runs `load` and expects its *result* to be the
          // migration Effect (or a module with a `.default`), so wrap one level.
          return [migration.id, migration.name, Effect.succeed(run)];
        }),
      ),
    );
  }).pipe(
    Effect.mapError(
      (error) =>
        new Migrator.MigrationError({
          reason: "failed",
          message: error.message,
        }),
    ),
  );
