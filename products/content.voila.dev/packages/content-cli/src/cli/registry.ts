// `voila list` and `voila add` — the registry commands. `list` browses the
// catalog of vendable items; `add` resolves an item's dependency graph, copies
// the real source files into the app (skipping existing ones unless
// `--overwrite`), and installs the npm packages they need. The catalog,
// dependency resolution, and file vending live in `@voila/content-registry`;
// this file parses flags, formats output, and drives the package manager.
// Both `add` and `diff` first check `--cwd` is a voila app and remap targets
// to its source directory (see `./host`).

import { existsSync } from "node:fs";
import { isAbsolute, join, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import {
  diffFiles,
  type FileDiff,
  fileTarget,
  listItems,
  type RegistryFile,
  type RegistryItem,
  type RegistryItemType,
  registry,
  resolve as resolvePlan,
  vendFiles,
} from "@voila/content-registry";
import { resolveSrcDirectory, retargetFiles, validateHost } from "./host";
import { CliError } from "./index";

const TYPES = ["shell", "route", "block", "field", "lib"] as const;

const LIST_USAGE = `voila list — browse the registry catalog of vendable items.

Usage: voila list [--type <type>]

Options:
  --type <type>   Filter by item type (${TYPES.join(" | ")}).
  -h, --help      Show this help.`;

const ADD_USAGE = `voila add — vend registry items (and their deps) into your app.

Usage: voila add <item...> [options]

Options:
  --cwd <dir>     Target app directory (default ".").
  --overwrite     Replace existing vended files (a drift diff is shown first).
  --no-install    Print the dependency install command instead of running it.
  --dry-run       Show what would be written/installed, then exit.
  -h, --help      Show this help.`;

const DIFF_USAGE = `voila diff — show drift between your vended copy and upstream.

Usage: voila diff [item...] [--cwd <dir>]

Options:
  --cwd <dir>     Target app directory (default ".").
  -h, --help      Show this help.`;

export async function runList(args: ReadonlyArray<string>): Promise<void> {
  const { values } = parseArgs({
    args: [...args],
    options: { type: { type: "string" }, help: { type: "boolean", short: "h" } },
    strict: true,
  });
  if (values.help as boolean) return void console.log(LIST_USAGE);

  const type = values.type as string | undefined;
  if (type !== undefined && !TYPES.includes(type as RegistryItemType)) {
    throw new CliError(`Invalid --type "${type}". Expected one of: ${TYPES.join(", ")}.`);
  }

  const items = listItems(registry, type as RegistryItemType | undefined);
  if (items.length === 0) {
    console.log(type ? `No registry items of type "${type}".` : "The registry is empty.");
    return;
  }

  console.log(formatCatalog(items));
}

export async function runAdd(args: ReadonlyArray<string>): Promise<void> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: {
      cwd: { type: "string", default: "." },
      overwrite: { type: "boolean", default: false },
      // `node:util` parseArgs has no built-in `--no-x` negation here, so the
      // skip-install flag is its own boolean (install is on by default).
      "no-install": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });
  if (values.help as boolean) return void console.log(ADD_USAGE);

  if (positionals.length === 0) {
    throw new CliError('Usage: voila add <item...>. Run "voila list" to see the catalog.');
  }

  // resolve() throws a RegistryError (caught + printed by bin.ts) on an unknown
  // item, a dependency cycle, or a conflict — so the plan below is always sound.
  const plan = resolvePlan(registry, positionals);
  const cwdArg = values.cwd as string;
  const cwd = isAbsolute(cwdArg) ? cwdArg : resolvePath(process.cwd(), cwdArg);
  validateHost(cwd);
  const files = retargetFiles(plan.files, resolveSrcDirectory(cwd));
  const deps = Object.entries(plan.dependencies);

  if (values["dry-run"] as boolean) {
    console.log("Would write:");
    for (const file of files) console.log(`  ${fileTarget(file)}`);
    if (deps.length > 0) {
      console.log("Would install:");
      for (const [pkg, range] of deps) console.log(`  ${pkg}@${range}`);
    }
    return;
  }

  // `--overwrite` replaces files in place. Before clobbering, surface any
  // locally-modified file's drift so the edits about to be lost are visible in
  // the command output rather than silently overwritten.
  const overwrite = values.overwrite as boolean;
  if (overwrite) {
    const drift = (await diffFiles(files, { cwd })).filter((d) => d.status === "modified");
    if (drift.length > 0) {
      console.log(
        `⚠ --overwrite will replace ${drift.length} locally-modified file(s); the edits below will be lost:\n`,
      );
      console.log(`${formatDiffs(drift)}\n`);
    }
  }

  const result = await vendFiles(files, { cwd, overwrite });
  for (const target of result.written) console.log(`  + ${target}`);
  for (const target of result.skipped) {
    console.log(`  · ${target} (exists — pass --overwrite to replace)`);
  }

  if (deps.length === 0) return;

  const specs = deps.map(([pkg, range]) => `${pkg}@${range}`);
  if (values["no-install"] as boolean) {
    const pm = detectPackageManager(cwd);
    console.log(`\nDependencies to install:\n  ${pm} add ${specs.join(" ")}`);
    return;
  }
  installDependencies(cwd, specs);
}

export async function runDiff(args: ReadonlyArray<string>): Promise<void> {
  const { values, positionals } = parseArgs({
    args: [...args],
    options: { cwd: { type: "string", default: "." }, help: { type: "boolean", short: "h" } },
    allowPositionals: true,
    strict: true,
  });
  if (values.help as boolean) return void console.log(DIFF_USAGE);

  const cwdArg = values.cwd as string;
  const cwd = isAbsolute(cwdArg) ? cwdArg : resolvePath(process.cwd(), cwdArg);
  validateHost(cwd);

  // Named items diff their resolved plan; with no names, diff the whole catalog.
  const planned: ReadonlyArray<RegistryFile> =
    positionals.length > 0
      ? resolvePlan(registry, positionals).files
      : resolvePlan(
          registry,
          registry.items.map((item) => item.name),
        ).files;
  const files = retargetFiles(planned, resolveSrcDirectory(cwd));

  console.log(formatDiffs(await diffFiles(files, { cwd })));
}

/** Render the diffs: only changed (`+`/`-`) lines per modified file, plus a
 *  one-line summary. Unchanged files are counted but not printed. */
function formatDiffs(diffs: ReadonlyArray<FileDiff>): string {
  const blocks: string[] = [];
  let unchanged = 0;
  let modified = 0;
  let missing = 0;

  for (const diff of diffs) {
    if (diff.status === "unchanged") {
      unchanged++;
    } else if (diff.status === "missing") {
      missing++;
      blocks.push(`missing   ${diff.target}`);
    } else {
      modified++;
      const lines = [`modified  ${diff.target}`];
      for (const hunk of diff.hunks ?? []) {
        if (hunk.type === "ctx") continue;
        lines.push(`  ${hunk.type === "add" ? "+" : "-"} ${hunk.text}`);
      }
      blocks.push(lines.join("\n"));
    }
  }

  const summary = `${diffs.length} file(s): ${unchanged} unchanged, ${modified} modified, ${missing} missing.`;
  return blocks.length === 0
    ? `Everything is up to date.\n\n${summary}`
    : `${blocks.join("\n\n")}\n\n${summary}`;
}

/** Pick the package manager from the app's lockfile, defaulting to bun. */
function detectPackageManager(cwd: string): string {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  return "bun";
}

function installDependencies(cwd: string, specs: ReadonlyArray<string>): void {
  const pm = detectPackageManager(cwd);
  console.log(`\nInstalling with ${pm}: ${specs.join(" ")}`);
  const proc = Bun.spawnSync({
    cmd: [pm, "add", ...specs],
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (proc.exitCode !== 0) {
    throw new CliError(`Dependency install failed (${pm} exited ${proc.exitCode}).`);
  }
}

/** Render items grouped into type sections (in `TYPES` order); within a section
 *  items keep their catalog order. */
function formatCatalog(items: ReadonlyArray<RegistryItem>): string {
  const sections: string[] = [];
  for (const type of TYPES) {
    const group = items.filter((item) => item.type === type);
    if (group.length === 0) continue;
    const lines = [`${type}:`];
    for (const item of group) {
      lines.push(`  ${item.name}  —  ${item.title}`);
      lines.push(`      ${item.description}`);
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n");
}
