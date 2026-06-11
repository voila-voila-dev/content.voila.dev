// Filesystem `Storage` for local development — uploads land under a directory
// (e.g. `.voila/media`). Node/Bun only (it imports `node:fs`), like the
// `bun:sqlite` driver: workers use the R2 or S3 adapter instead.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import type { Storage, StorageObject } from "./types";

export interface FsStorageOpts {
  /** Directory objects are stored under (created on first write). */
  readonly directory: string;
}

// Keys are engine-minted (`<uuid>/<sanitized filename>`), but resolve defensively
// anyway: a key must stay inside the storage directory once joined.
function resolveKey(directory: string, key: string): string {
  const path = normalize(join(directory, key));
  const root = normalize(directory) + sep;
  if (!path.startsWith(root)) throw new Error(`Storage key escapes the directory: "${key}".`);
  return path;
}

export function makeFsStorage(opts: FsStorageOpts): Storage {
  return {
    id: "fs",
    async put(key, body) {
      const path = resolveKey(opts.directory, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },
    async get(key): Promise<StorageObject | null> {
      try {
        const body = await readFile(resolveKey(opts.directory, key));
        return { body: new Uint8Array(body), size: body.byteLength };
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(resolveKey(opts.directory, key), { force: true });
    },
  };
}
