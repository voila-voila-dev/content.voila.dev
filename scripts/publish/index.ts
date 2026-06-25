#!/usr/bin/env bun
/**
 * Protocol-resolving workspace publish — the repo's `release` step.
 *
 * `changeset publish` (npm under the hood) ships the LITERAL `workspace:` and
 * `catalog:` dependency specs in the published manifests. npm can't resolve
 * either on install, so those packages are uninstallable (this is exactly how
 * the first 0.2.0 / 0.1.3 publish broke). This script publishes each public,
 * not-yet-published package with both protocols resolved to concrete versions:
 *
 *   - `workspace:*` / `workspace:` -> the sibling package's current version
 *   - `workspace:^` / `workspace:~` -> `^x.y.z` / `~x.y.z`
 *   - `catalog:` -> the version from the root `workspaces.catalog`
 *
 * It never mutates committed source: per package it resolves -> `npm publish`
 * -> restores the original `package.json` (so the working tree keeps the
 * protocols). Publishes in dependency order, skips versions already on npm, and
 * aborts on an unexpected major jump (a guard against changeset's peer-dep
 * mis-major) unless `--allow-major`.
 *
 * Usage: bun scripts/publish [--dry-run] [--allow-major]
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const ALLOW_MAJOR = args.has("--allow-major");

interface Pkg {
  name?: string;
  version?: string;
  private?: boolean;
  workspaces?: string[] | { packages?: string[]; catalog?: Record<string, string> };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function read(path: string): Pkg {
  return JSON.parse(readFileSync(path, "utf8"));
}

const rootPkg = read(join(ROOT, "package.json"));
const workspaces = rootPkg.workspaces;
const catalog: Record<string, string> =
  (Array.isArray(workspaces) ? undefined : workspaces?.catalog) ?? {};
const patterns: string[] = Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);

// Discover every workspace package: name -> { dir, version, private }.
const pkgs = new Map<string, { dir: string; version: string; isPrivate: boolean }>();
for (const pattern of patterns) {
  for (const rel of new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: ROOT })) {
    const d = read(join(ROOT, rel));
    if (d.name && d.version) {
      pkgs.set(d.name, {
        dir: join(ROOT, rel.slice(0, -"/package.json".length)),
        version: d.version,
        isPrivate: d.private === true,
      });
    }
  }
}

/** A manifest copy with `workspace:`/`catalog:` resolved; returns [pkg, count]. */
function resolveManifest(original: Pkg): [Pkg, number] {
  const out = structuredClone(original);
  let n = 0;
  for (const sec of DEP_SECTIONS) {
    const deps = out[sec];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (spec.startsWith("workspace:")) {
        const version = pkgs.get(name)?.version;
        if (!version)
          throw new Error(`cannot resolve "${spec}" for ${name} (not a workspace package)`);
        const suffix = spec.slice("workspace:".length);
        deps[name] =
          suffix === "*" || suffix === ""
            ? version
            : suffix === "^"
              ? `^${version}`
              : suffix === "~"
                ? `~${version}`
                : suffix; // an explicit range after `workspace:` is used verbatim
        n++;
      } else if (spec === "catalog:") {
        const version = catalog[name];
        if (!version)
          throw new Error(`cannot resolve "catalog:" for ${name} (not in root catalog)`);
        deps[name] = version;
        n++;
      }
    }
  }
  return [out, n];
}

/** Topologically order the names so a dependency publishes before its dependents. */
function publishOrder(names: string[]): string[] {
  const set = new Set(names);
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (name: string, stack: Set<string>) => {
    if (seen.has(name) || stack.has(name)) return;
    const entry = pkgs.get(name);
    if (!entry) return;
    stack.add(name);
    const d = read(join(entry.dir, "package.json"));
    const deps = { ...d.dependencies, ...d.peerDependencies, ...d.optionalDependencies };
    for (const dep of Object.keys(deps)) if (set.has(dep)) visit(dep, stack);
    stack.delete(name);
    seen.add(name);
    order.push(name);
  };
  for (const name of names) visit(name, new Set());
  return order;
}

function npmLatest(name: string): string | null {
  const r = spawnSync("npm", ["view", name, "version"], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

const majorOf = (v: string) => Number(v.split(".")[0]);

const publishable = [...pkgs.entries()].filter(([, m]) => !m.isPrivate).map(([name]) => name);
const order = publishOrder(publishable);

let published = 0;
let skipped = 0;
for (const name of order) {
  const entry = pkgs.get(name);
  if (!entry) continue;
  const { dir, version } = entry;
  const latest = npmLatest(name);
  if (latest === version) {
    console.log(`= ${name}@${version} already on npm — skip`);
    skipped++;
    continue;
  }
  if (latest && majorOf(version) > majorOf(latest) && !ALLOW_MAJOR) {
    console.error(
      `✗ ${name}: ${latest} -> ${version} is a MAJOR jump. ` +
        "If intended, re-run with --allow-major; otherwise check `changeset version` " +
        "didn't mis-escalate a peer dependent.",
    );
    process.exit(1);
  }

  const path = join(dir, "package.json");
  const original = readFileSync(path, "utf8");
  try {
    const [resolved, count] = resolveManifest(JSON.parse(original));
    writeFileSync(path, `${JSON.stringify(resolved, null, 2)}\n`);
    console.log(
      `\n${DRY ? "DRY-RUN " : ""}${name}@${version}${latest ? ` (from ${latest})` : " (new)"} — resolved ${count} protocol spec(s)`,
    );
    if (DRY) {
      for (const sec of ["dependencies", "peerDependencies"] as const) {
        if (resolved[sec]) console.log(`    ${sec}: ${JSON.stringify(resolved[sec])}`);
      }
    }
    const r = spawnSync("npm", ["publish", "--access", "public", ...(DRY ? ["--dry-run"] : [])], {
      cwd: dir,
      stdio: "inherit",
    });
    if (r.status !== 0) {
      writeFileSync(path, original);
      console.error(`✗ publish failed for ${name} (exit ${r.status})`);
      process.exit(r.status ?? 1);
    }
    published++;
  } finally {
    writeFileSync(path, original); // restore committed source (keep the protocols)
  }
}

console.log(`\n${DRY ? "[dry-run] " : ""}done — ${published} published, ${skipped} skipped.`);
