// The scaffolding core: copy the app template into a target directory. The
// template is the whole app — `content.config.ts`, the Cloudflare/wrangler
// config, and the fixed admin route shims that re-export `@voila/content-admin`'s
// screens. There's nothing to vend: the admin's CRUD logic, layout, and server
// wiring all live in the versioned `@voila/content-admin` package, so a fresh app is a
// handful of fixed files plus your config (see ADR 0003). Template files get
// dotfile stubs renamed (`dot-gitignore` → `.gitignore`, since npm refuses to
// publish real dotfiles; `dot-` rather than a leading `_` so it never collides
// with names like TanStack's `__root.tsx`) and `{{...}}` placeholders
// substituted. Pure filesystem work, separate from the CLI so it's testable
// against a temp dir.

import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the bundled app template. */
export const TEMPLATE_DIR: string = fileURLToPath(new URL("../template/", import.meta.url));

export interface ScaffoldOptions {
  readonly targetDir: string;
  readonly projectName: string;
  /** The site's apex domain — the admin deploys to `admin.<clientDomain>`.
   *  Defaults to `example.com` (a placeholder to edit in `wrangler.jsonc`). */
  readonly clientDomain?: string;
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

/** Copy the template into `targetDir`, renaming dotfile stubs and substituting
 *  the `{{...}}` placeholders. Returns the list of files written. */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const templateDir = options.templateDir ?? TEMPLATE_DIR;
  const authSecret = generateAuthSecret();
  const clientDomain = options.clientDomain ?? "example.com";
  const substitute = (contents: string) =>
    contents
      .replaceAll("{{projectName}}", options.projectName)
      .replaceAll("{{authSecret}}", authSecret)
      .replaceAll("{{clientDomain}}", clientDomain)
      // A placeholder id so `bun run dev` works immediately (local miniflare D1
      // only needs a non-empty id). Replace it with the real id from
      // `wrangler d1 create` before deploying.
      .replaceAll("{{d1DatabaseId}}", randomUUID());

  const files: string[] = [];
  for (const rel of await walk(templateDir)) {
    const target = destName(rel);
    const dest = join(options.targetDir, target);
    const source = substitute(await readFile(join(templateDir, rel), "utf8"));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, source, "utf8");
    files.push(target);
  }

  return { files: files.sort() };
}
