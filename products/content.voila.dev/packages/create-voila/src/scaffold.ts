// The scaffolding core: copy the app template into a target directory, renaming
// dotfile stubs (`dot-gitignore` → `.gitignore`, since npm refuses to publish
// real dotfiles) and substituting `{{projectName}}` placeholders in the text
// files. The `dot-` prefix is used rather than a leading `_` so it never
// collides with legitimate names like TanStack's `__root.tsx`. Pure filesystem
// work, separate from the CLI so it's testable against a temp dir.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the bundled app template. */
export const TEMPLATE_DIR: string = fileURLToPath(new URL("../template/", import.meta.url));

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

/** Copy the template into `targetDir`, renaming dotfile stubs and substituting
 *  `{{projectName}}`. Returns the list of files written. */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const templateDir = options.templateDir ?? TEMPLATE_DIR;
  const relPaths = await walk(templateDir);
  const written: string[] = [];

  for (const rel of relPaths) {
    const source = await readFile(join(templateDir, rel), "utf8");
    const contents = source.replaceAll("{{projectName}}", options.projectName);
    const outRel = destName(rel);
    const dest = join(options.targetDir, outRel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, contents, "utf8");
    written.push(outRel);
  }

  return { files: written };
}
