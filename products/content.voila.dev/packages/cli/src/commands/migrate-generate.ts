import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { DatabaseDialect } from "@voila/content-database";
import { schemaGenerate } from "./schema-generate.ts";

export interface MigrateGenerateOptions {
  /** Working directory. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Path to the config file, relative to `cwd`. Defaults to `./content.config.ts`. */
  config?: string;
  /** Output directory for migrations, relative to `cwd`. Defaults to `./migrations`. */
  out?: string;
  /** Migration name (passed straight to `drizzle-kit generate --name`). */
  name?: string;
  /** SQL dialect. `"sqlite"` covers D1 too. */
  dialect?: DatabaseDialect;
  /** Override the bridge schema file path. */
  bridge?: string;
  /**
   * Override the binary used to invoke drizzle-kit. Defaults to `bunx`. The
   * subcommand `drizzle-kit generate` is always appended. Tests inject a
   * stub here.
   */
  drizzleKitBin?: string;
}

export interface MigrateGenerateResult {
  /** Absolute path of the bridge schema file. */
  bridge: string;
  /** Absolute path of the migrations directory. */
  outDir: string;
  /** Whether drizzle-kit reported new SQL written. We surface this by re-listing files. */
  status: "delegated";
}

const DRIZZLE_DIALECT: Record<DatabaseDialect, "sqlite" | "postgresql"> = {
  sqlite: "sqlite",
  postgres: "postgresql",
};

/**
 * Generate the next migration via drizzle-kit.
 *
 * Flow:
 *   1. `schemaGenerate` writes the bridge file (`drizzle/schema.gen.ts`)
 *      from `content.config.ts`.
 *   2. Spawn `bunx drizzle-kit generate --schema <bridge> --out <out> --dialect <…>`.
 *      Drizzle-kit owns snapshotting (`meta/_journal.json` + per-migration
 *      snapshot), diffing (CREATE → ALTER), and file naming/idempotency.
 *
 * Step 1 is the same function the standalone `voila schema generate`
 * command runs; if you only need the bridge (e.g. to power your own
 * `drizzle.config.ts`), call that command directly.
 */
export async function migrateGenerate(
  options: MigrateGenerateOptions = {},
): Promise<MigrateGenerateResult> {
  const cwd = options.cwd ?? process.cwd();
  const dialect = options.dialect ?? "sqlite";
  const outDir = resolve(cwd, options.out ?? "./migrations");

  mkdirSync(outDir, { recursive: true });

  const schema = await schemaGenerate({
    cwd,
    config: options.config,
    bridge: options.bridge,
    dialect,
  });

  const flags = [
    "drizzle-kit",
    "generate",
    "--dialect",
    DRIZZLE_DIALECT[dialect],
    "--schema",
    schema.bridge,
    "--out",
    outDir,
  ];
  if (options.name) flags.push("--name", options.name);

  const bin = options.drizzleKitBin ?? "bunx";
  const result = spawnSync(bin, flags, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${bin} ${flags.join(" ")} exited with status ${result.status}`);
  }

  return { bridge: schema.bridge, outDir, status: "delegated" };
}
