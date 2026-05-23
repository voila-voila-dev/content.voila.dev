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

/**
 * Build a D1 adapter from a worker `env` binding whose static type is unknown.
 *
 * Generated route files read the binding off `cloudflare:workers`' `env`, which
 * is untyped unless the consumer has run `wrangler types`. The Cloudflare
 * runtime guarantees the binding is a real D1 database at request time, so this
 * helper centralizes the one unavoidable cast and keeps the generated routes
 * free of `as` noise. Throws if the binding is missing — a misconfigured
 * `wrangler.jsonc` `d1_databases` binding name is the usual cause.
 */
export function d1FromBinding(binding: unknown): D1Adapter {
  if (binding == null) {
    throw new Error(
      "d1FromBinding: D1 binding is missing — check the binding name under `d1_databases` in wrangler.jsonc (expected `DATABASE`).",
    );
  }
  return d1({ binding: binding as AnyD1Database });
}
