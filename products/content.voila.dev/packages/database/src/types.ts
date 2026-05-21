export type DatabaseDialect = "sqlite" | "postgres";

export type DatabaseDriver = "better-sqlite3" | "bun-sqlite" | "d1" | "postgres-js";

export interface DatabaseAdapter<TDrizzle = unknown> {
  readonly dialect: DatabaseDialect;
  readonly driver: DatabaseDriver;
  readonly drizzle: TDrizzle;
  close?(): Promise<void> | void;
}

// biome-ignore lint/suspicious/noExplicitAny: variance escape hatch — code that operates on any adapter shape uses this constraint.
export type AnyDatabaseAdapter = DatabaseAdapter<any>;
