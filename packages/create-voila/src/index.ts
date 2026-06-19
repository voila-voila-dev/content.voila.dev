// create-voila — scaffolds a fresh TanStack Start app wired to voila. Copies the
// bundled template into a target directory, installs dependencies with the
// detected package manager, and generates the first migration from the seeded
// `content.config.ts`. The filesystem copy lives in `./scaffold` (tested
// directly); this module drives the flow and the package manager.

import { existsSync, readdirSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { parseArgs } from "node:util";
import { slugify } from "@voila/content";
import { scaffold } from "./scaffold";

/** A user-facing failure — `bin.ts` prints the message and exits non-zero. */
export class CreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateError";
  }
}

export { scaffold, TEMPLATE_DIR } from "./scaffold";

/** Normalize a directory name into a valid npm package name — the canonical
 *  `slugify` (every slug output is also a valid package name). */
export function toPackageName(input: string): string {
  return slugify(input) || "voila-app";
}

export async function run(argv: ReadonlyArray<string>): Promise<void> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      name: { type: "string" },
      "no-install": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  const dir = positionals[0];
  if (dir === undefined) {
    throw new CreateError(
      "Usage: create-voila <directory> [--name <pkg>] [--no-install] [--force]",
    );
  }

  const targetDir = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0 && !(values.force as boolean)) {
    throw new CreateError(
      `Directory "${dir}" is not empty. Pass --force to scaffold into it anyway.`,
    );
  }

  const projectName = toPackageName((values.name as string | undefined) ?? basename(targetDir));

  const result = await scaffold({ targetDir, projectName });
  console.log(`Scaffolded ${projectName} (${result.files.length} files) in ${dir}`);

  const pm = detectPackageManager();
  if (values["no-install"] as boolean) {
    printNextSteps(dir, pm, { installed: false });
    return;
  }

  install(targetDir, pm);
  generateMigration(targetDir, pm);
  printNextSteps(dir, pm, { installed: true });
}

/** Detect the package manager that launched `create-voila` from the npm user
 *  agent (set by `bun create` / `npm create` / etc.), defaulting to bun. */
function detectPackageManager(): string {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("npm")) return "npm";
  return "bun";
}

function install(cwd: string, pm: string): void {
  console.log(`\nInstalling dependencies with ${pm}…`);
  const proc = Bun.spawnSync({
    cmd: [pm, "install"],
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (proc.exitCode !== 0) {
    throw new CreateError(`Dependency install failed (${pm} exited ${proc.exitCode}).`);
  }
}

function generateMigration(cwd: string, pm: string): void {
  console.log("\nGenerating the first migration…");
  const proc = Bun.spawnSync({
    cmd: [pm, "run", "migrate:generate"],
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (proc.exitCode !== 0) {
    throw new CreateError("Could not generate the first migration — run it manually after setup.");
  }
}

function printNextSteps(dir: string, pm: string, opts: { readonly installed: boolean }): void {
  const runCmd = pm === "npm" ? "npm run" : pm;
  const steps = [`  cd ${dir}`];
  if (!opts.installed) {
    steps.push(`  ${pm} install`, `  ${runCmd} migrate:generate`);
  }
  steps.push(`  ${runCmd} migrate:apply`, `  ${runCmd} dev`);
  console.log(
    `\nNext steps:\n${steps.join("\n")}\n\nThen open http://localhost:3000/admin — it's secure by ` +
      `default, so you'll be sent to /admin/login. Enter an email and open the magic-link URL ` +
      `printed to the dev server terminal (look for "[voila/auth] magic link"). The first ` +
      `account to sign in becomes the admin.`,
  );
}
