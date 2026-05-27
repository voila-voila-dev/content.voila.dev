import { Database } from "bun:sqlite";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export interface MigrateApplyOptions {
  /** Working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Migrations directory, relative to `cwd`. Defaults to `./migrations`. */
  out?: string;
  /**
   * Target. `"sqlite"` opens a local sqlite file via Drizzle's bun-sqlite
   * migrator. `"postgres"` opens a connection via Drizzle's postgres-js
   * migrator. `"d1-local"` and `"d1-remote"` shell out to
   * `wrangler d1 migrations apply`.
   */
  target?: "sqlite" | "postgres" | "d1-local" | "d1-remote";
  /**
   * Database location, required for the local migrator targets:
   *   - `sqlite`   → a SQLite URL (`":memory:"`, `"file:./voila.db"`, or a bare path)
   *   - `postgres` → a connection URL (`postgres://user:pass@host:5432/db`)
   */
  db?: string;
  /** Wrangler D1 binding name. Required when target is `"d1-local"` / `"d1-remote"`. */
  binding?: string;
  /** Wrangler config path (passed via `--config`). Optional. */
  wranglerConfig?: string;
  /** Override the wrangler binary (`"wrangler"` by default — picked up from PATH or a workspace shim). */
  wranglerBin?: string;
}

export interface MigrateApplyResult {
  /** The target this run dispatched to. */
  target: "sqlite" | "postgres" | "d1-local" | "d1-remote";
  /**
   * `true` when the apply was handed off to wrangler. Drizzle's `migrate()`
   * and wrangler both own structured tracking tables (`__drizzle_migrations`
   * and `d1_migrations` respectively); we don't try to second-guess them by
   * surfacing a list of files here.
   */
  delegated: boolean;
}

const DEFAULT_OUT_DIR = "./migrations";

/**
 * Apply pending migrations.
 *
 * - **Local SQLite** opens the file via `bun:sqlite` and calls Drizzle's
 *   `migrate()`, which tracks applied migrations in `__drizzle_migrations`.
 * - **Postgres** opens a connection via the `@voila/content-database/postgres`
 *   adapter and calls Drizzle's postgres-js `migrate()`, which tracks applied
 *   migrations in the `drizzle.__drizzle_migrations` table.
 * - **D1 (local + remote)** shells out to `wrangler d1 migrations apply
 *   <binding> [--local|--remote]`; wrangler owns the `d1_migrations` table.
 *
 * Every code path delegates to a third-party that already does idempotency
 * and tracking — we just dispatch.
 */
export async function migrateApply(options: MigrateApplyOptions = {}): Promise<MigrateApplyResult> {
  const cwd = options.cwd ?? process.cwd();
  const outDir = resolve(cwd, options.out ?? DEFAULT_OUT_DIR);
  const target = options.target ?? "sqlite";

  if (target === "d1-local" || target === "d1-remote") {
    return applyViaWrangler({ cwd, out: options.out, target, options });
  }

  if (target === "postgres") {
    if (!options.db) {
      throw new Error(`migrate apply: --db is required when target is "postgres"`);
    }
    return applyLocalPostgres({ outDir, url: options.db });
  }

  if (!options.db) {
    throw new Error(`migrate apply: --db is required when target is "sqlite"`);
  }
  return applyLocalSqlite({ cwd, outDir, url: options.db });
}

function applyLocalSqlite(args: { cwd: string; outDir: string; url: string }): MigrateApplyResult {
  const filename = resolveSqliteUrl(args.url);
  const db = new Database(filename === ":memory:" ? ":memory:" : resolve(args.cwd, filename));
  try {
    const drizzleDb = drizzle(db);
    migrate(drizzleDb, { migrationsFolder: args.outDir });
    return { target: "sqlite", delegated: false };
  } finally {
    db.close();
  }
}

/**
 * Apply migrations to Postgres via Drizzle's postgres-js migrator.
 *
 * Both the adapter and the migrator are imported lazily so that sqlite/D1
 * users never pull in the optional `postgres` peer dependency just by loading
 * the CLI — it's only required when `--target postgres` is actually used. The
 * adapter (`@voila/content-database/postgres`) is the same one the runtime
 * write path uses, which is where migration parity comes from.
 */
async function applyLocalPostgres(args: {
  outDir: string;
  url: string;
}): Promise<MigrateApplyResult> {
  const [{ postgres }, { migrate: migratePostgres }] = await Promise.all([
    import("@voila/content-database/postgres"),
    import("drizzle-orm/postgres-js/migrator"),
  ]);
  const adapter = postgres({ url: args.url });
  try {
    await migratePostgres(adapter.drizzle, { migrationsFolder: args.outDir });
    return { target: "postgres", delegated: false };
  } finally {
    await adapter.close?.();
  }
}

function applyViaWrangler(args: {
  cwd: string;
  out: string | undefined;
  target: "d1-local" | "d1-remote";
  options: MigrateApplyOptions;
}): MigrateApplyResult {
  const { options, target, cwd } = args;
  if (!options.binding) {
    throw new Error(`migrate apply: --binding is required when target is "${target}"`);
  }
  // wrangler reads `migrations_dir` from wrangler.jsonc and has no CLI flag
  // to override it. A divergent --out would silently apply different files
  // than the CLI claims; refuse instead.
  if (args.out !== undefined && args.out !== DEFAULT_OUT_DIR) {
    throw new Error(
      `migrate apply: --out "${args.out}" is only supported for --target sqlite. ` +
        `For D1, set "migrations_dir" in wrangler.jsonc and omit --out (or pass --out ${DEFAULT_OUT_DIR}).`,
    );
  }
  const flags = [
    "d1",
    "migrations",
    "apply",
    options.binding,
    target === "d1-remote" ? "--remote" : "--local",
  ];
  if (options.wranglerConfig) flags.push("--config", options.wranglerConfig);
  const bin = options.wranglerBin ?? "wrangler";
  const result = spawnSync(bin, flags, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${bin} ${flags.join(" ")} exited with status ${result.status}`);
  }
  return { target, delegated: true };
}

function resolveSqliteUrl(url: string): string {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}
