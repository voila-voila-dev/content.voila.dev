import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import type { DatabaseAdapter } from "../types.ts";

export interface SqliteAdapterOptions {
  /**
   * libsql-style URL or a plain file path.
   *
   * - `":memory:"` or `"file::memory:"` → in-memory database
   * - `"file:./relative/path.db"` → relative file path (the `file:` prefix is stripped)
   * - `"file:/absolute/path.db"` → absolute file path
   * - `"./path.db"` → bare path, passed straight through to `bun:sqlite`
   */
  url: string;
}

export type SqliteAdapter = DatabaseAdapter<BunSQLiteDatabase> & {
  readonly driver: "bun-sqlite";
};

export function sqlite(options: SqliteAdapterOptions): SqliteAdapter {
  const filename = resolveSqliteUrl(options.url);
  const client = new Database(filename);
  return {
    dialect: "sqlite",
    driver: "bun-sqlite",
    drizzle: drizzle(client),
    close: () => client.close(),
  };
}

export function resolveSqliteUrl(url: string): string {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  if (url.startsWith("file:")) return url.slice("file:".length);
  return url;
}
