import { type AnyD1Database, type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { DatabaseAdapter } from "../types.ts";

export interface D1AdapterOptions {
  /**
   * The D1 binding from the worker's `env`. Pass `env.<BINDING_NAME>` —
   * whatever you've declared under `d1_databases` in `wrangler.jsonc`.
   */
  binding: AnyD1Database;
}

export type D1Adapter = DatabaseAdapter<DrizzleD1Database> & {
  readonly driver: "d1";
};

export function d1(options: D1AdapterOptions): D1Adapter {
  return {
    dialect: "sqlite",
    driver: "d1",
    drizzle: drizzle(options.binding),
  };
}
