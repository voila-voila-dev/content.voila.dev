// A concrete `AccessControl` policy: first-user-wins. The first account to land
// in the Better Auth `user` table claims the admin; every later (unknown) email
// still authenticates but is denied (the guard maps the denial to 403). This is
// the secure-by-default policy the scaffold wires — a fresh app is locked to its
// owner the moment they sign in, with no allowlist to maintain.
//
// It reads the auth `user` table directly through the engine's `SqlDriver`
// (schema in `@voila/content/sql`), so it needs neither `better-auth` nor a
// session — just the same connection the auth tables live on. The first user is
// immutable once it exists, so the id is resolved once and memoized.

import type { SqlDriver } from "../../database/driver";
import type { AccessControl } from "../access";

/**
 * Build an `AccessControl` hook that admits only the earliest-created user.
 *
 * The first user id is resolved lazily (on the first authorized request, by
 * which point the user row exists) and cached — the earliest `createdAt` never
 * changes. Until a first user exists every request is denied; in practice the
 * caller is already authenticated, so their own row guarantees a non-empty table.
 */
export function firstUserAccess(driver: SqlDriver): AccessControl {
  let firstUserId: string | undefined;

  return async ({ principal }) => {
    if (firstUserId === undefined) {
      const rows = await driver.all(
        'SELECT "id" FROM "user" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1',
      );
      const id = rows[0]?.id;
      // No users yet (or a non-string id): nobody owns the admin, so deny.
      if (typeof id !== "string") return false;
      firstUserId = id;
    }
    return principal.id === firstUserId;
  };
}
