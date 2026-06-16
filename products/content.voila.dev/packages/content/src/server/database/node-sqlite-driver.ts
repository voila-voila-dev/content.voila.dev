// `makeNodeSqliteDriver` — a `SqlDriver` over the built-in `node:sqlite`
// synchronous driver (unflagged since Node 22.13). This is what a scaffolded
// app uses under `vite dev`, whose SSR runtime is Node: the CLI migrates
// `local.db` under Bun, the app opens the same file here. The connection opens
// eagerly and is released via `close()` (call it on teardown).
//
// Exposed as `@voila/content/server/node-sqlite`, NOT from the `./server`
// barrel, mirroring the bun:sqlite driver — each runtime imports only its own.
// `node:sqlite` is resolved lazily via `process.getBuiltinModule` rather than
// a module-scope import so the module itself loads on any runtime (bundlers,
// Bun) and only the factory demands Node's SQLite.

import { coerceBindings, type SqlRow, type SqlValue } from "./driver";
import { resolveSqliteUrl, type SqliteDriver, type SqliteDriverOpts } from "./sqlite";

export { resolveSqliteUrl, type SqliteDriver, type SqliteDriverOpts } from "./sqlite";

function loadNodeSqlite(): typeof import("node:sqlite") {
  const mod = process.getBuiltinModule?.("node:sqlite");
  if (!mod) {
    throw new Error(
      "node:sqlite is not available in this runtime (requires Node >= 22.13). " +
        "Under Bun, use makeBunSqliteDriver from @voila/content/server/bun-sqlite instead.",
    );
  }
  return mod;
}

// `coerceBindings` already folds booleans to 0/1, so every remaining value is
// in `node:sqlite`'s accepted set — the cast just narrows the static type.
function bind(params: ReadonlyArray<SqlValue>): Array<import("node:sqlite").SQLInputValue> {
  return coerceBindings(params) as Array<import("node:sqlite").SQLInputValue>;
}

export function makeNodeSqliteDriver(opts: SqliteDriverOpts): SqliteDriver {
  const { DatabaseSync } = loadNodeSqlite();
  const db = new DatabaseSync(resolveSqliteUrl(opts.url));
  return {
    all(sql: string, params: ReadonlyArray<SqlValue> = []): Promise<ReadonlyArray<SqlRow>> {
      return Promise.resolve(db.prepare(sql).all(...bind(params)) as Array<SqlRow>);
    },
    run(sql: string, params: ReadonlyArray<SqlValue> = []): Promise<void> {
      db.prepare(sql).run(...bind(params));
      return Promise.resolve();
    },
    close(): void {
      db.close();
    },
  };
}
