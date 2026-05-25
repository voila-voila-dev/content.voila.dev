#!/usr/bin/env bun
/**
 * Package-aggregate line-coverage gate (roadmap M1 testing bar).
 *
 * Bun's native `coverageThreshold` is enforced *per file*, so it can't express
 * "this package's total line coverage must be ≥ N%". This script runs a
 * package's tests with coverage — the package's own `bunfig.toml` emits lcov
 * and scopes the report to its own `src/` via `coveragePathIgnorePatterns` —
 * then sums the per-line `DA:` records across the package and fails if the
 * aggregate falls below the gate.
 *
 * Usage: bun scripts/coverage-gate <packageDir> <minPercent>
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const [pkgArg, minArg] = process.argv.slice(2);
if (!pkgArg || minArg === undefined) {
  console.error("usage: bun scripts/coverage-gate <packageDir> <minPercent>");
  process.exit(2);
}

const pkgDir = resolve(process.cwd(), pkgArg);
const min = Number(minArg);
const covDir = join(pkgDir, "coverage");

// Run the package's own suite with coverage. The package bunfig.toml turns on
// the lcov reporter and the `../**` ignore that keeps the report to this
// package's source.
const run = spawnSync("bun", ["test", "--coverage"], { cwd: pkgDir, stdio: "inherit" });
if (run.status !== 0) {
  // A non-zero status here means tests failed — surface it as-is.
  process.exit(run.status ?? 1);
}

const lcovPath = join(covDir, "lcov.info");
if (!existsSync(lcovPath)) {
  console.error(
    `coverage gate: expected lcov at ${relative(process.cwd(), lcovPath)} — none found`,
  );
  process.exit(1);
}

const lcov = readFileSync(lcovPath, "utf8");
rmSync(covDir, { recursive: true, force: true });

// lcov `DA:<line>,<hitCount>` — one per executable line. Found = total,
// hit = lines with a non-zero count.
let found = 0;
let hit = 0;
for (const line of lcov.split("\n")) {
  if (!line.startsWith("DA:")) continue;
  found++;
  if (Number(line.slice(line.indexOf(",") + 1)) > 0) hit++;
}

const pct = found === 0 ? 100 : (hit / found) * 100;
const ok = pct >= min;
console.log(
  `\ncoverage gate · ${pkgArg}: ${pct.toFixed(2)}% lines (${hit}/${found}) · min ${min}% · ${ok ? "PASS ✓" : "FAIL ✗"}`,
);
process.exit(ok ? 0 : 1);
