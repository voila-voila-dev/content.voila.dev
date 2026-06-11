// In-memory `Storage` — the universal test double and throwaway-dev default,
// mirroring the `:memory:` SQLite driver. Objects live in a `Map` and vanish
// with the process.

import type { Storage, StorageObject } from "./types";

export function makeMemoryStorage(): Storage {
  const objects = new Map<string, Uint8Array>();
  return {
    id: "memory",
    async put(key, body) {
      // Copy so a caller mutating its buffer after `put` can't alter the store.
      objects.set(key, body.slice());
    },
    async get(key): Promise<StorageObject | null> {
      const body = objects.get(key);
      return body === undefined ? null : { body, size: body.byteLength };
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
