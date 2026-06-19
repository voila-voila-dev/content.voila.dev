// Writing vended files into a consumer app. Given the files from a resolved
// install plan, copy each one's source (read off disk by `./files`) to its
// target under the app root, creating directories as needed. Existing files are
// left untouched unless `overwrite` is set — vended files are the app's own
// code, so `voila add` never clobbers local edits by default. Kept fs-only and
// separate from the resolver so it can be unit-tested against a temp dir.
//
// `read` and `transform` let other writers reuse the same loop: create-voila
// vends its app template through here, reading from its own template directory
// and substituting `{{projectName}}` placeholders on the way out.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readItemFile } from "./files";
import { fileTarget, type RegistryFile } from "./types";

export interface VendOptions {
  /** The consumer app root that targets are written relative to. */
  readonly cwd: string;
  /** Overwrite a target that already exists (default: skip it). */
  readonly overwrite?: boolean;
  /** Read a file's source text. Defaults to the registry's own `src/items/`. */
  readonly read?: (file: RegistryFile) => Promise<string>;
  /** Transform source before writing (e.g. placeholder substitution). */
  readonly transform?: (contents: string, file: RegistryFile) => string;
}

export interface VendResult {
  /** Targets written, relative to `cwd`. */
  readonly written: ReadonlyArray<string>;
  /** Targets skipped because they already existed (and `overwrite` was off). */
  readonly skipped: ReadonlyArray<string>;
}

/** Copy each file's source to its target under `cwd`, skipping existing files
 *  unless `overwrite`. Returns what was written vs. skipped. */
export async function vendFiles(
  files: ReadonlyArray<RegistryFile>,
  options: VendOptions,
): Promise<VendResult> {
  const read = options.read ?? readItemFile;
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const target = fileTarget(file);
    const dest = join(options.cwd, target);
    if (!options.overwrite && existsSync(dest)) {
      skipped.push(target);
      continue;
    }
    const source = await read(file);
    const contents = options.transform ? options.transform(source, file) : source;
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, contents, "utf8");
    written.push(target);
  }

  return { written, skipped };
}
