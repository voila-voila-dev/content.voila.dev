// `makeSqliteDriver` — a `SqlDriver` over the built-in `bun:sqlite` synchronous
// driver. Used for local development, migrations, and as the universal test
// double (an in-memory `:memory:` connection). The connection opens eagerly and
// is released via `close()` (call it on teardown).

import { Database } from "bun:sqlite";
import { coerceBindings, type SqlDriver, type SqlRow, type SqlValue } from "./driver";

export interface SqliteDriverOpts {
  /** libsql-style URL (`file:./local.db`, `:memory:`) or a bare file path. */
  readonly url: string;
}

export interface SqliteDriver extends SqlDriver {
  /** Close the underlying connection. */
  close(): void;
}

/**
 * Normalize a libsql-style URL to the filename `bun:sqlite` opens.
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

export function makeSqliteDriver(opts: SqliteDriverOpts): SqliteDriver {
  const db = new Database(resolveSqliteUrl(opts.url));
  return {
    all(sql: string, params: ReadonlyArray<SqlValue> = []): Promise<ReadonlyArray<SqlRow>> {
      return Promise.resolve(db.query(sql).all(...coerceBindings(params)) as Array<SqlRow>);
    },
    run(sql: string, params: ReadonlyArray<SqlValue> = []): Promise<void> {
      db.query(sql).run(...coerceBindings(params));
      return Promise.resolve();
    },
    close(): void {
      db.close();
    },
  };
}
