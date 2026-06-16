// The runtime-neutral half of the SQLite driver story: the shared option and
// handle types plus URL normalization. The actual drivers bind to a runtime's
// built-in SQLite and therefore live on their own subpaths —
// `@voila/content/server/bun-sqlite` (Bun) and
// `@voila/content/server/node-sqlite` (Node ≥ 22.13) — so importing
// `@voila/content/server` never pulls in a runtime-specific module.

import type { SqlDriver } from "./driver";

export interface SqliteDriverOpts {
  /** libsql-style URL (`file:./local.db`, `:memory:`) or a bare file path. */
  readonly url: string;
}

export interface SqliteDriver extends SqlDriver {
  /** Close the underlying connection. */
  close(): void;
}

/**
 * Normalize a libsql-style URL to the filename the runtime's SQLite opens.
 *
 * - `:memory:` / `file::memory:` → `:memory:` (anonymous in-memory db)
 * - `file:./local.db` / `file:/abs/local.db` → strips the `file:` scheme
 * - bare paths pass through unchanged
 */
export function resolveSqliteUrl(url: string): string {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}
