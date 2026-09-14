// An access *policy* bundles the per-request RBAC hook (`AccessControl`) with an
// optional admission check the host can consult before a session exists — at
// magic-link sign-in, and in the `/admin` route guard. `firstUserAccess` has no
// admission check (nobody owns the admin until someone signs in); the
// collection-backed allowlist does.
//
// Policies that need the runtime's handles (driver, database, config) are
// declared as factories and built by the admin runtime, so a host writes
// `access: allowlistAccess()` instead of plumbing the driver through by hand.

import type { NormalizedConfig } from "../../config/config";
import type { SqlDriver } from "../database/driver";
import type { Database } from "../database/types";
import type { AccessControl } from "./access";

export interface AccessPolicy {
  /** The per-request RBAC hook the REST guard runs. */
  readonly access: AccessControl;
  /**
   * Whether an email address is admitted to the admin at all. Consulted before
   * a magic link is sent and by the host's route guard. Absent when the policy
   * cannot decide from an email alone (first-user-wins).
   */
  readonly admits?: (email: string) => Promise<boolean>;
}

/** What a policy factory receives from the admin runtime. */
export interface AccessPolicyContext {
  readonly driver: SqlDriver;
  readonly database: Database;
  readonly config: NormalizedConfig;
}

export interface AccessPolicyFactory {
  readonly build: (context: AccessPolicyContext) => AccessPolicy;
}

/** What a host may pass as `access`: a bare hook or a policy factory. */
export type AccessOption = AccessControl | AccessPolicyFactory;

/** Turn an `access` option into a policy, falling back to `fallback` when unset. */
export function resolveAccessPolicy(
  option: AccessOption | undefined,
  context: AccessPolicyContext,
  fallback: () => AccessControl,
): AccessPolicy {
  if (option === undefined) return { access: fallback() };
  if (typeof option === "function") return { access: option };
  return option.build(context);
}
