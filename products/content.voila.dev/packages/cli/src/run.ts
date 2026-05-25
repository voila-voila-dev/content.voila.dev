import { migrateApply } from "./commands/migrate-apply.ts";
import { migrateGenerate } from "./commands/migrate-generate.ts";
import { migrateInstallAuth } from "./commands/migrate-install-auth.ts";
import { schemaGenerate } from "./commands/schema-generate.ts";
import { seedAdmin } from "./commands/seed-admin.ts";

export type CliIO = {
  out: (line: string) => void;
  err: (line: string) => void;
};

const DEFAULT_IO: CliIO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

const USAGE = `voila — Voila CMS toolbelt

Usage:
  voila schema generate  [--dialect sqlite|postgres] [--bridge <path>] [--config <path>]
  voila migrate generate [--name <slug>] [--dialect sqlite|postgres] [--out <dir>] [--bridge <path>] [--config <path>]
  voila migrate apply    [--target sqlite|d1-local|d1-remote] [--db <url>] [--binding <name>] [--out <dir>] [--config <wrangler.jsonc>]
  voila migrate install-auth [--dialect sqlite|postgres] [--out <dir>]
  voila seed admin       --email <addr> [--name <name>] [--target sqlite|d1-local|d1-remote] [--db <url>] [--binding <name>] [--config <wrangler.jsonc>]
`;

export async function run(argv: readonly string[], io: CliIO = DEFAULT_IO): Promise<number> {
  const [cmd, sub, ...rest] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h") {
    io.out(USAGE);
    return 0;
  }
  if (cmd === "schema" && sub === "generate") return runSchemaGenerate(rest, io);
  if (cmd === "migrate" && sub === "generate") return runGenerate(rest, io);
  if (cmd === "migrate" && sub === "apply") return runApply(rest, io);
  if (cmd === "migrate" && sub === "install-auth") return runInstallAuth(rest, io);
  if (cmd === "seed" && sub === "admin") return runSeedAdmin(rest, io);
  io.err(`unknown command: voila ${[cmd, sub].filter(Boolean).join(" ")}`);
  io.err(USAGE);
  return 1;
}

async function runSchemaGenerate(rest: readonly string[], io: CliIO): Promise<number> {
  let flags: Record<string, string>;
  try {
    flags = parseFlags(rest);
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
  const dialect = (flags.dialect as "sqlite" | "postgres" | undefined) ?? "sqlite";
  if (dialect !== "sqlite" && dialect !== "postgres") {
    io.err(`unknown --dialect: ${flags.dialect}`);
    return 1;
  }
  try {
    const result = await schemaGenerate({
      dialect,
      bridge: flags.bridge,
      config: flags.config,
    });
    io.out(`voila: wrote ${result.bridge}`);
    io.out(
      `        ${result.collections.length} collection${result.collections.length === 1 ? "" : "s"} (${dialect}): ${result.collections.join(", ") || "(none)"}`,
    );
    return 0;
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
}

async function runGenerate(rest: readonly string[], io: CliIO): Promise<number> {
  let flags: Record<string, string>;
  try {
    flags = parseFlags(rest);
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
  const dialect = (flags.dialect as "sqlite" | "postgres" | undefined) ?? "sqlite";
  if (dialect !== "sqlite" && dialect !== "postgres") {
    io.err(`unknown --dialect: ${flags.dialect}`);
    return 1;
  }
  try {
    const result = await migrateGenerate({
      name: flags.name,
      dialect,
      out: flags.out,
      bridge: flags.bridge,
      config: flags.config,
    });
    io.out(`voila: generate delegated to drizzle-kit (see output above).`);
    io.out(`        bridge:     ${result.bridge}`);
    io.out(`        migrations: ${result.outDir}`);
    return 0;
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
}

async function runApply(rest: readonly string[], io: CliIO): Promise<number> {
  let flags: Record<string, string>;
  try {
    flags = parseFlags(rest);
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
  const target = (flags.target as "sqlite" | "d1-local" | "d1-remote" | undefined) ?? "sqlite";
  if (target !== "sqlite" && target !== "d1-local" && target !== "d1-remote") {
    io.err(`unknown --target: ${flags.target}`);
    return 1;
  }
  try {
    const result = await migrateApply({
      target,
      db: flags.db,
      binding: flags.binding,
      out: flags.out,
      wranglerConfig: flags.config,
    });
    if (result.delegated) {
      io.out(`voila: ${target} apply delegated to wrangler (see output above).`);
    } else {
      io.out(`voila: sqlite apply complete (drizzle migrator).`);
    }
    return 0;
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
}

async function runInstallAuth(rest: readonly string[], io: CliIO): Promise<number> {
  let flags: Record<string, string>;
  try {
    flags = parseFlags(rest);
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
  const dialect = (flags.dialect as "sqlite" | "postgres" | undefined) ?? "sqlite";
  if (dialect !== "sqlite" && dialect !== "postgres") {
    io.err(`unknown --dialect: ${flags.dialect}`);
    return 1;
  }
  try {
    const result = await migrateInstallAuth({ dialect, out: flags.out });
    if (result.installed) {
      io.out(`voila: installed ${result.filename} → ${result.destination}`);
    } else {
      io.out(`voila: auth migration already present at ${result.destination} (skipped)`);
    }
    return 0;
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
}

async function runSeedAdmin(rest: readonly string[], io: CliIO): Promise<number> {
  let flags: Record<string, string>;
  try {
    flags = parseFlags(rest);
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
  const target = (flags.target as "sqlite" | "d1-local" | "d1-remote" | undefined) ?? "sqlite";
  if (target !== "sqlite" && target !== "d1-local" && target !== "d1-remote") {
    io.err(`unknown --target: ${flags.target}`);
    return 1;
  }
  if (!flags.email) {
    io.err("seed admin: --email is required");
    return 1;
  }
  try {
    const result = await seedAdmin({
      email: flags.email,
      name: flags.name,
      target,
      db: flags.db,
      binding: flags.binding,
      wranglerConfig: flags.config,
    });
    io.out(`voila: ${result.action} admin ${result.email} (id ${result.id}) on ${result.target}`);
    return 0;
  } catch (e) {
    io.err((e as Error).message);
    return 1;
  }
}

/**
 * Minimal flag parser supporting `--key value` and `--key=value`. Every flag
 * here takes a value (we have no booleans yet), so a missing value — or the
 * next token starting with `--` — is treated as a user error rather than
 * silently coerced to `"true"`. Throws on malformed input; the caller wraps
 * the exception into a CLI-friendly error.
 */
function parseFlags(rest: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${arg}`);
    }
    const eq = arg.indexOf("=");
    if (eq > -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`flag --${key} requires a value`);
    }
    out[key] = next;
    i++;
  }
  return out;
}
