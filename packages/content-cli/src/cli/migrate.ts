// `voila migrate` — the `generate` and `apply` subcommands. Business logic lives
// in `../sql/migrator`; this file only parses flags (via `node:util` parseArgs)
// and wires them to those functions.

import { parseArgs } from "node:util";
import type { Dialect } from "@voila/content/sql";
import { type ApplyTarget, applyD1, applySqlite } from "../sql/migrator/apply";
import { generateMigration } from "../sql/migrator/generate";
import { loadConfig } from "./config";
import { CliError } from "./index";

const DIALECTS = ["sqlite", "postgres"] as const;
const TARGETS = ["sqlite", "d1-local", "d1-remote"] as const;

const GENERATE_USAGE = `voila migrate generate — generate a migration from the content config.

Usage: voila migrate generate [options]

Options:
  --config <path>   Content config file (default "content.config.ts").
  --dir <dir>       Migrations directory (default "migrations").
  --name <name>     Migration name (default "migration").
  --dialect <d>     SQL dialect: ${DIALECTS.join(" | ")} (default "sqlite").
  --auth            Also emit the Better Auth tables (sqlite only).
  -h, --help        Show this help.`;

const APPLY_USAGE = `voila migrate apply — apply pending migrations to a target.

Usage: voila migrate apply [options]

Options:
  --dir <dir>       Migrations directory (default "migrations").
  --target <t>      Target: ${TARGETS.join(" | ")} (default "sqlite").
  --db <database>   DB URL (sqlite) or D1 database name/binding (required for d1-*).
  -h, --help        Show this help.`;

export async function runMigrate(args: ReadonlyArray<string>): Promise<void> {
  const [sub, ...rest] = args;
  switch (sub) {
    case "generate":
      return runGenerate(rest);
    case "apply":
      return runApply(rest);
    default:
      throw new CliError(
        `Unknown migrate subcommand: ${sub ?? "(none)"}. Expected "generate" or "apply".`,
      );
  }
}

async function runGenerate(args: ReadonlyArray<string>): Promise<void> {
  const { values } = parseArgs({
    args: [...args],
    options: {
      config: { type: "string", default: "content.config.ts" },
      dir: { type: "string", default: "migrations" },
      name: { type: "string", default: "migration" },
      dialect: { type: "string", default: "sqlite" },
      auth: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  if (values.help as boolean) return void console.log(GENERATE_USAGE);

  const dialect = values.dialect as string;
  if (!DIALECTS.includes(dialect as Dialect)) {
    throw new CliError(`Invalid --dialect "${dialect}". Expected one of: ${DIALECTS.join(", ")}.`);
  }
  const auth = values.auth as boolean;
  if (auth && dialect !== "sqlite") {
    throw new CliError(
      "--auth is only supported with --dialect sqlite; the Postgres auth schema lands with the pg client.",
    );
  }

  const config = await loadConfig(values.config as string);
  const path = await generateMigration({
    config,
    dir: values.dir as string,
    name: values.name as string,
    dialect: dialect as Dialect,
    auth,
  });
  console.log(`Created ${path}`);
}

async function runApply(args: ReadonlyArray<string>): Promise<void> {
  const { values } = parseArgs({
    args: [...args],
    options: {
      dir: { type: "string", default: "migrations" },
      target: { type: "string", default: "sqlite" },
      db: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });
  if (values.help as boolean) return void console.log(APPLY_USAGE);

  const target = values.target as string;
  if (!TARGETS.includes(target as ApplyTarget)) {
    throw new CliError(`Invalid --target "${target}". Expected one of: ${TARGETS.join(", ")}.`);
  }
  const dir = values.dir as string;

  if (target === "sqlite") {
    const url = (values.db as string | undefined) ?? "file:./local.db";
    const applied = await applySqlite({ dir, url });
    console.log(
      applied.length === 0
        ? "Already up to date."
        : `Applied ${applied.length} migration(s): ${applied
            .map(([id, name]) => `${id}_${name}`)
            .join(", ")}`,
    );
    return;
  }

  const database = values.db as string | undefined;
  if (database === undefined) {
    throw new CliError(
      `--db <database> is required for target '${target}' (the D1 database name or binding).`,
    );
  }
  applyD1({ database, target: target as "d1-local" | "d1-remote" });
  console.log(`Applied migrations to ${target} (${database}).`);
}
