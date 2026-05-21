import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgresClient from "postgres";
import type { DatabaseAdapter } from "../types.ts";

export interface PostgresAdapterOptions {
  /**
   * Postgres connection URL (e.g. `postgres://user:pass@host:5432/db`). Parsed
   * by `postgres-js` — query-string parameters (`?sslmode=require`, `?host=…`,
   * etc.) are honored.
   */
  url: string;
}

export type PostgresAdapter = DatabaseAdapter<PostgresJsDatabase> & {
  readonly driver: "postgres-js";
};

export function postgres(options: PostgresAdapterOptions): PostgresAdapter {
  const client = postgresClient(options.url);
  return {
    dialect: "postgres",
    driver: "postgres-js",
    drizzle: drizzle(client),
    close: () => client.end(),
  };
}
