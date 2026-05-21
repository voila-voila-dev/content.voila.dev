// Scaffold only — the postgres-js implementation lands in M2 (see
// products/content.voila.dev/docs/requirements/12-roadmap.md). The signature
// below is the public surface; calling `postgres()` throws until then.

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { DatabaseAdapter } from "../types.ts";

export interface PostgresAdapterOptions {
  /**
   * Postgres connection URL (e.g. `postgres://user:pass@host:5432/db`). The
   * M2 implementation will also accept a pre-configured `postgres()` client
   * for connection-pool sharing across processes.
   */
  url: string;
}

export type PostgresAdapter = DatabaseAdapter<PostgresJsDatabase> & {
  readonly driver: "postgres-js";
};

export function postgres(_options: PostgresAdapterOptions): PostgresAdapter {
  throw new Error(
    "@voila/content-database/postgres lands in M2 — see docs/requirements/12-roadmap.md.",
  );
}
