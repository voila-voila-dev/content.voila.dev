/**
 * `voila migrate install-auth` — copy the SQL migration bundled with
 * `@voila/content-auth` into the consumer's `migrations/` directory so
 * `voila migrate apply` provisions the better-auth tables alongside the
 * collection schema.
 *
 * Resolved path comes from the installed `@voila/content-auth` package's
 * `./migrations` export. We pick the next free `NNNN_auth_init.sql` slot
 * (mirroring drizzle-kit's numeric ordering) so the auth migration always
 * runs after the existing schema migrations and doesn't clash with the
 * timestamp-based names drizzle-kit emits.
 *
 * Idempotent: re-running detects an already-installed auth migration by
 * the trailing `_auth_init.sql` suffix and skips, so consumers can wire
 * the command into a `postinstall` hook without surprises.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface MigrateInstallAuthOptions {
  /** Working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Migrations directory, relative to `cwd`. Defaults to `./migrations`. */
  out?: string;
  /** Dialect the consumer's database uses. Defaults to `sqlite`. */
  dialect?: "sqlite" | "postgres";
  /**
   * Override the resolved source path. Tests pass a vendored fixture;
   * production callers leave this undefined to resolve via Node module
   * resolution.
   */
  sourcePath?: string;
}

export interface MigrateInstallAuthResult {
  /** `true` when a new file was copied, `false` when an auth migration already existed. */
  installed: boolean;
  /** Absolute path to the auth migration in the consumer's migrations directory. */
  destination: string;
  /** Filename chosen for the destination (without the directory portion). */
  filename: string;
}

const DEFAULT_OUT_DIR = "./migrations";

export async function migrateInstallAuth(
  options: MigrateInstallAuthOptions = {},
): Promise<MigrateInstallAuthResult> {
  const cwd = options.cwd ?? process.cwd();
  const outDir = resolve(cwd, options.out ?? DEFAULT_OUT_DIR);
  const dialect = options.dialect ?? "sqlite";

  const source = options.sourcePath ?? (await resolveBundledMigration(dialect));
  if (!existsSync(source)) {
    throw new Error(
      `migrate install-auth: bundled migration not found at ${source}. Reinstall @voila/content-auth.`,
    );
  }

  mkdirSync(outDir, { recursive: true });
  const existing = readdirSync(outDir).filter((f) => f.endsWith("_auth_init.sql"));
  if (existing[0]) {
    return {
      installed: false,
      destination: join(outDir, existing[0]),
      filename: existing[0],
    };
  }

  const filename = `${nextMigrationPrefix(outDir)}_auth_init.sql`;
  const destination = join(outDir, filename);
  copyFileSync(source, destination);
  return { installed: true, destination, filename };
}

/**
 * Pick the next free 4-digit numeric prefix. Looks at every file in the
 * directory matching `NNNN_*.sql` and returns the max + 1, zero-padded.
 * Defaults to `0000` for a brand-new project.
 */
export function nextMigrationPrefix(outDir: string): string {
  if (!existsSync(outDir)) return "0000";
  let max = -1;
  for (const entry of readdirSync(outDir)) {
    const match = /^(\d{4})_/.exec(entry);
    if (!match || !match[1]) continue;
    const n = Number.parseInt(match[1], 10);
    if (n > max) max = n;
  }
  return String(max + 1).padStart(4, "0");
}

/**
 * Resolve the bundled migration via the package's `./migrations` export.
 * `import.meta.resolve` returns a file:// URL — strip to a plain path.
 */
async function resolveBundledMigration(dialect: "sqlite" | "postgres"): Promise<string> {
  const manifest = await import("@voila/content-auth/migrations");
  const filename = manifest.AUTH_MIGRATIONS[dialect];
  // The manifest sits next to the SQL files; resolve the manifest module then
  // dirname() it to find the migrations directory.
  const manifestUrl = (import.meta as ImportMeta & { resolve: (s: string) => string }).resolve(
    "@voila/content-auth/migrations",
  );
  const manifestPath = manifestUrl.startsWith("file://")
    ? new URL(manifestUrl).pathname
    : manifestUrl;
  return join(dirname(manifestPath), filename);
}
