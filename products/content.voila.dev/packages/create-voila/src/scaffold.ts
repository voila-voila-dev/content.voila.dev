// The scaffolding core: copy the app template into a target directory, then
// vend the registry's default item set on top. The admin source (shell, routes,
// client) lives only in `@voila/content-registry` — the template carries just
// the app chrome (config, package.json, vite, the demo collection routes) — so
// a fresh app and `voila add`/`voila diff` can never diverge. Template files
// get dotfile stubs renamed (`dot-gitignore` → `.gitignore`, since npm refuses
// to publish real dotfiles; `dot-` rather than a leading `_` so it never
// collides with names like TanStack's `__root.tsx`) and `{{projectName}}`
// placeholders substituted. Pure filesystem work, separate from the CLI so it's
// testable against a temp dir.

import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type RegistryFile, registry, resolve, vendFiles } from "@voila/content-registry";

/** Absolute path to the bundled app template. */
export const TEMPLATE_DIR: string = fileURLToPath(new URL("../template/", import.meta.url));

/** The registry items every fresh app starts from. `resolve` pulls in their
 *  registry dependencies (content-client, admin-shell) dependency-first. The
 *  `widgets` seam ships `app/lib/widgets.ts`, which the demo pages import their
 *  field widget registries from — so `voila add rich-text-editor` drops the
 *  editor into every page by overwriting just that one file. */
export const DEFAULT_ITEMS: ReadonlyArray<string> = ["admin-routes", "widgets"];

export interface ScaffoldOptions {
  readonly targetDir: string;
  readonly projectName: string;
  /** Template directory to copy from. Defaults to the bundled `TEMPLATE_DIR`. */
  readonly templateDir?: string;
}

export interface ScaffoldResult {
  /** Files written, as paths relative to `targetDir` (post-rename). */
  readonly files: ReadonlyArray<string>;
}

/** List every file under `dir`, as paths relative to it, depth-first. */
async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else {
      out.push(relative(base, full));
    }
  }
  return out.sort();
}

/** Map a template path to its written name: a `dot-` prefix on the basename
 *  becomes `.` so dotfiles survive npm packaging (`dot-gitignore` →
 *  `.gitignore`), without disturbing names that merely start with `_`. */
export function destName(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  const dir = slash === -1 ? "" : relPath.slice(0, slash + 1);
  const base = relPath.slice(slash + 1);
  return base.startsWith("dot-") ? `${dir}.${base.slice("dot-".length)}` : relPath;
}

/** Mint a fresh high-entropy secret for the app's `.env` (`VOILA_AUTH_SECRET`),
 *  used to sign auth sessions, magic-link tokens, and the CSRF double-submit
 *  token. Generated once per scaffold so every app ships with its own. */
function generateAuthSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** Copy the template into `targetDir` (renaming dotfile stubs, substituting
 *  `{{projectName}}` and the generated `{{authSecret}}`), then vend the
 *  registry's default item set on top. Returns the list of files written. */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const templateDir = options.templateDir ?? TEMPLATE_DIR;
  const authSecret = generateAuthSecret();
  const substitute = (contents: string) =>
    contents
      .replaceAll("{{projectName}}", options.projectName)
      .replaceAll("{{authSecret}}", authSecret);

  const templateFiles: ReadonlyArray<RegistryFile> = (await walk(templateDir)).map((rel) => ({
    path: rel,
    target: destName(rel),
  }));
  const fromTemplate = await vendFiles(templateFiles, {
    cwd: options.targetDir,
    overwrite: true,
    read: (file) => readFile(join(templateDir, file.path), "utf8"),
    transform: substitute,
  });

  const plan = resolve(registry, DEFAULT_ITEMS);
  const fromRegistry = await vendFiles(plan.files, {
    cwd: options.targetDir,
    overwrite: true,
    transform: substitute,
  });

  return { files: [...fromTemplate.written, ...fromRegistry.written].sort() };
}
