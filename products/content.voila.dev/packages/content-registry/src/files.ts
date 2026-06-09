// Reading vended file contents off disk. The registry ships its item files as
// real source under `src/items/`; `voila add` reads them here and writes them
// into the consumer's app. Kept separate from the manifest so the resolver
// stays pure and testable without touching the filesystem.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryFile } from "./types";

/** Absolute path to the directory holding the vended item source files. */
export const ITEMS_DIR: string = fileURLToPath(new URL("./items/", import.meta.url));

/** Absolute on-disk path of a registry file's source. */
export function itemSourcePath(file: RegistryFile): string {
  return join(ITEMS_DIR, file.path);
}

/** Read a registry file's source contents as UTF-8 text. */
export function readItemFile(file: RegistryFile): Promise<string> {
  return readFile(itemSourcePath(file), "utf8");
}
