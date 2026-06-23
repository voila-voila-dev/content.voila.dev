// `voila migrate apply` — run pending `NNNN_name.sql` migrations against a
// target.
//
// - `sqlite`: applies the files through `bun:sqlite` and records each in the
//   `voila_migrations` journal table (id + name), inside a transaction per file.
// - `d1-local` / `d1-remote`: a database binding only exists inside a Worker, so
//   the CLI shells out to `wrangler d1 migrations apply`, which runs the same
//   files and tracks them in D1's own `d1_migrations` table.

import { Database } from "bun:sqlite";
import { spawnSync } from "node:child_process";
import { loadMigrations } from "./loader";

export type ApplyTarget = "sqlite" | "d1-local" | "d1-remote";

/** The journal table recording which migrations have been applied. */
const JOURNAL = "voila_migrations";

export interface ApplySqliteOpts {
  /** Directory holding the `NNNN_name.sql` migration files. */
  readonly dir: string;
  /** Database URL (`file:./local.db`, `:memory:`, or a bare path). */
  readonly url: string;
}

/** Resolve a database URL to the path `bun:sqlite` opens. */
function sqlitePath(url: string): string {
  if (url === ":memory:") return url;
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}

/**
 * Apply pending migrations to a local SQLite database. Returns the list of
 * `[id, name]` pairs that were applied (empty when already up to date).
 */
export async function applySqlite(
  opts: ApplySqliteOpts,
): Promise<ReadonlyArray<readonly [id: number, name: string]>> {
  const db = new Database(sqlitePath(opts.url));
  try {
    db.run(
      `CREATE TABLE IF NOT EXISTS "${JOURNAL}" (
         id INTEGER PRIMARY KEY,
         name TEXT NOT NULL,
         applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
       )`,
    );
    const applied = new Set(
      db
        .query(`SELECT id FROM "${JOURNAL}"`)
        .all()
        .map((r) => (r as { id: number }).id),
    );

    const migrations = await loadMigrations(opts.dir);
    const record = db.query(`INSERT INTO "${JOURNAL}" (id, name) VALUES (?, ?)`);
    const ran: Array<readonly [number, string]> = [];

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      const apply = db.transaction(() => {
        for (const statement of migration.statements) db.run(statement);
        record.run(migration.id, migration.name);
      });
      apply();
      ran.push([migration.id, migration.name]);
    }

    return ran;
  } finally {
    db.close();
  }
}

export interface ApplyD1Opts {
  /** D1 database name or binding, e.g. `playground` / `DATABASE`. */
  readonly database: string;
  /** `d1-local` (miniflare) or `d1-remote` (Cloudflare). */
  readonly target: "d1-local" | "d1-remote";
}

/**
 * Apply migrations to D1 by delegating to Wrangler. Inherits stdio so Wrangler's
 * prompts and progress reach the user, and runs in the current working directory
 * (where `wrangler.jsonc` and the configured `migrations_dir` live). Throws on a
 * non-zero exit.
 */
export function applyD1(opts: ApplyD1Opts): void {
  const scope = opts.target === "d1-local" ? "--local" : "--remote";
  const result = spawnSync("wrangler", ["d1", "migrations", "apply", opts.database, scope], {
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`failed to run wrangler: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`wrangler d1 migrations apply exited with code ${result.status}`);
  }
}
