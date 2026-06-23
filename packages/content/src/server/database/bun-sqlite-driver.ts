// `makeBunSqliteDriver` — a `SqlDriver` over the built-in `bun:sqlite`
// synchronous driver. Used for local development, migrations, and as the
// universal test double (an in-memory `:memory:` connection). The connection
// opens eagerly and is released via `close()` (call it on teardown).
//
// Exposed as `@voila/content/server/bun-sqlite`, NOT from the `./server`
// barrel: `bun:sqlite` is imported at module scope, and a barrel re-export
// would make every Node consumer of `./server` throw on load.

import { Database } from "bun:sqlite";
import { coerceBindings, type SqlRow, type SqlValue } from "./driver";
import { resolveSqliteUrl, type SqliteDriver, type SqliteDriverOpts } from "./sqlite";

export { resolveSqliteUrl, type SqliteDriver, type SqliteDriverOpts } from "./sqlite";

export function makeBunSqliteDriver(opts: SqliteDriverOpts): SqliteDriver {
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
