// `voila migrate apply` — run pending `NNNN_name.sql` migrations against a
// target.
//
// - `sqlite`: `@effect/sql/Migrator` (via the bun-sqlite Migrator) applies the
//   files through the custom `.sql` loader and records them in its journal
//   table (`effect_sql_migrations`).
// - `d1-local` / `d1-remote`: a `SqlClient` binding only exists inside a Worker,
//   so the CLI shells out to `wrangler d1 migrations apply`, which runs the same
//   files and tracks them in D1's own `d1_migrations` table.

import { Command } from "@effect/platform";
import type { CommandExecutor } from "@effect/platform/CommandExecutor";
import type { FileSystem } from "@effect/platform/FileSystem";
import type { Path } from "@effect/platform/Path";
import * as Migrator from "@effect/sql/Migrator";
import { SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Effect } from "effect";
import { SqliteLive } from "../client/sqlite";
import { fromSqlFiles } from "./loader";

export type ApplyTarget = "sqlite" | "d1-local" | "d1-remote";

export interface ApplySqliteOpts {
  /** Directory holding the `NNNN_name.sql` migration files. */
  readonly dir: string;
  /** Database URL (`file:./local.db`, `:memory:`, or a bare path). */
  readonly url: string;
}

/**
 * Apply pending migrations to a local SQLite database. Returns the list of
 * `[id, name]` pairs that were applied (empty when already up to date).
 */
export const applySqlite = (
  opts: ApplySqliteOpts,
): Effect.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError,
  FileSystem | Path | CommandExecutor
> =>
  SqliteMigrator.run({ loader: fromSqlFiles(opts.dir) }).pipe(
    Effect.provide(SqliteLive({ url: opts.url })),
    // `SqliteLive` surfaces `ConfigError` only on a malformed driver config,
    // which can't happen for the static options we pass; treat as a defect.
    Effect.orDie,
  );

export interface ApplyD1Opts {
  /** D1 database name or binding, e.g. `playground` / `DATABASE`. */
  readonly database: string;
  /** `d1-local` (miniflare) or `d1-remote` (Cloudflare). */
  readonly target: "d1-local" | "d1-remote";
}

/**
 * Apply migrations to D1 by delegating to Wrangler. Inherits stdio so Wrangler's
 * prompts and progress reach the user, and runs in the current working
 * directory (where `wrangler.jsonc` and the configured `migrations_dir` live).
 * Fails with a `MigrationError` on a non-zero exit.
 */
export const applyD1 = (
  opts: ApplyD1Opts,
): Effect.Effect<void, Migrator.MigrationError, CommandExecutor> =>
  Effect.gen(function* () {
    const scope = opts.target === "d1-local" ? "--local" : "--remote";
    const command = Command.make(
      "wrangler",
      "d1",
      "migrations",
      "apply",
      opts.database,
      scope,
    ).pipe(Command.stdout("inherit"), Command.stderr("inherit"), Command.stdin("inherit"));

    const exitCode = yield* command.pipe(
      Command.exitCode,
      Effect.mapError(
        (error) =>
          new Migrator.MigrationError({
            reason: "failed",
            message: `failed to run wrangler: ${error.message}`,
          }),
      ),
    );

    if (exitCode !== 0) {
      return yield* Effect.fail(
        new Migrator.MigrationError({
          reason: "failed",
          message: `wrangler d1 migrations apply exited with code ${exitCode}`,
        }),
      );
    }
  });
