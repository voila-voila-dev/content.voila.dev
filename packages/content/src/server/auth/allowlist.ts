// A collection-backed allowlist: an account is admitted when its email appears
// in a collection of the host's own config (by default `admins`, field `email`).
// Editors manage the list from the admin itself — no environment variable to
// redeploy, no first-user race. Pair it with `defineAdminsCollection()` or any
// collection that carries a string field of email addresses.
//
// Verdicts are cached per email for a short TTL: the admin fires many REST
// requests per screen and each one runs the access hook.

import { toColumnName } from "../../sql/to-column-name";
import type { AccessPolicyFactory } from "./policy";

export interface AllowlistAccessOptions {
  /** Collection slug holding the admitted accounts. Default `admins`. */
  readonly collection?: string;
  /** String field holding the email address. Default `email`. */
  readonly field?: string;
  /** How long a verdict is reused before re-reading the table. Default 30 s. */
  readonly ttlMs?: number;
  /** Injected clock (tests). */
  readonly now?: () => number;
}

const DEFAULT_COLLECTION = "admins";
const DEFAULT_FIELD = "email";
const DEFAULT_TTL_MS = 30_000;

/**
 * Build the allowlist policy. Both the per-request `access` hook and the
 * pre-sign-in `admits` check answer from the same table, so an email removed
 * from the collection loses access within one TTL.
 *
 * Throws at build time when the collection or field is missing from the
 * config, so a typo surfaces at boot rather than as a silent lockout.
 */
export function allowlistAccess(options: AllowlistAccessOptions = {}): AccessPolicyFactory {
  const collection = options.collection ?? DEFAULT_COLLECTION;
  const field = options.field ?? DEFAULT_FIELD;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;

  return {
    build({ driver, config }) {
      const def = config.collections[collection];
      if (def === undefined) {
        throw new Error(
          `allowlistAccess: collection "${collection}" is not declared in the config.`,
        );
      }
      const fieldDef = def.fields[field];
      if (fieldDef === undefined || fieldDef.meta.kind !== "string") {
        throw new Error(
          `allowlistAccess: "${collection}.${field}" must be a string field holding email addresses.`,
        );
      }

      const table = `"${collection}"`;
      const column = `"${toColumnName(field)}"`;
      const sql = `SELECT 1 AS hit FROM ${table} WHERE lower(${column}) = ? AND "deleted_at" IS NULL LIMIT 1`;
      const verdicts = new Map<string, { allowed: boolean; until: number }>();

      const admits = async (email: string): Promise<boolean> => {
        const key = email.trim().toLowerCase();
        if (key === "") return false;
        const cached = verdicts.get(key);
        if (cached !== undefined && cached.until > now()) return cached.allowed;
        const rows = await driver.all(sql, [key]);
        const allowed = rows.length > 0;
        verdicts.set(key, { allowed, until: now() + ttlMs });
        return allowed;
      };

      return {
        admits,
        access: ({ principal }) =>
          principal.email === undefined ? false : admits(principal.email),
      };
    },
  };
}
