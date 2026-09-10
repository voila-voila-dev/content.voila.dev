#!/usr/bin/env bun
// Fill this site's D1 with the canonical Cinéma Vertigo programme.
//
//   bun run seed:local     # wrangler's local D1 state (what `vite dev` reads)
//   bun run seed:remote    # the real database named in wrangler.jsonc
//
// The content itself is NOT written here. `seedSandbox` in the admin demo is the
// one source of truth for the season — the same prose, translations, showtimes
// and relations a visitor sees inside the admin — so this script imports it and
// only takes care of getting its writes into D1.
//
// It does that by replaying the seed through the engine's own `Database` against
// a throwaway SQLite file (so `encodeRow` serializes geo/datetime/localized/
// richText exactly as the runtime expects), then dumping the resulting rows as
// INSERT statements and handing the file to `wrangler d1 execute`. That keeps
// one seeding path for local and remote, and needs no Worker to be running.

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { makeDatabase, type SqlDriver } from "@voila/content/server";
import { makeBunSqliteDriver } from "@voila/content/server/bun-sqlite";
import { deriveSchema } from "@voila/content/sql";
import { generateDDL } from "@voila/content-cli/sql/ddl";
import { seedProgramme } from "../app/lib/seed-data";
import config from "../content.config";

const WORK_DIR = ".voila";
const STAGING_DB = `${WORK_DIR}/seed.sqlite`;
const OUTPUT_SQL = `${WORK_DIR}/seed.sql`;

/** Every table the seed writes, in dependency order (relations are ids). */
const TABLES = ["people", "films", "screenings", "journal", "settings"] as const;

function quote(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Dump one table as a DELETE + one INSERT per row. Re-runnable by design. */
async function dumpTable(driver: SqlDriver, table: string): Promise<string> {
  const rows = await driver.all(`SELECT * FROM "${table}"`);
  const out = [`DELETE FROM "${table}";`];
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => quote(row[column]));
    out.push(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});`,
    );
  }
  return out.join("\n");
}

async function main(): Promise<void> {
  const remote = process.argv.includes("--remote");
  if (!remote && !process.argv.includes("--local")) {
    console.error("Usage: bun scripts/seed.ts --local | --remote");
    process.exit(1);
  }

  // 1. A clean staging database with this config's schema.
  mkdirSync(WORK_DIR, { recursive: true });
  rmSync(STAGING_DB, { force: true });
  const driver = makeBunSqliteDriver({ url: `file:${STAGING_DB}` });
  const ddl = generateDDL(deriveSchema(config), "sqlite");
  for (const statement of ddl
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    await driver.run(statement);
  }

  // 2. Replay the shared seed through the runtime Database.
  await seedProgramme(makeDatabase(config, driver));

  // 3. Dump it as re-runnable SQL.
  const sql = [];
  for (const table of TABLES) sql.push(await dumpTable(driver, table));
  writeFileSync(OUTPUT_SQL, `${sql.join("\n\n")}\n`);

  // 4. Hand it to wrangler. `--local` targets the same state `vite dev` reads.
  const args = ["d1", "execute", "DB", remote ? "--remote" : "--local", `--file=${OUTPUT_SQL}`];
  const result = spawnSync("wrangler", args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\nwrangler exited with ${result.status ?? "a signal"}.`);
    process.exit(result.status ?? 1);
  }
  console.log(`\nSeeded ${TABLES.length} collections into the ${remote ? "remote" : "local"} D1.`);
}

await main();
