// The authentication seam. An `Authenticator` turns an incoming `Request` into a
// `Principal` (or `null` when there's no valid session) — the same shape the
// `SqlDriver` seam plays for storage. The REST dispatcher calls it once per
// request; a `null` result is a 401 before any handler or collection lookup runs.
//
// This package ships the seam, not an implementation: a Better Auth bridge, a
// signed-cookie verifier, or a test stub each satisfy it as a swappable adapter.

import type { Principal } from "./principal";

export interface Authenticator {
  /**
   * Resolve the caller from request credentials (a session cookie, a bearer
   * token, …). Return the `Principal` on success, `null` when unauthenticated.
   * Throwing is reserved for genuine faults (a backend outage) and folds to a
   * 500 like any other handler throw.
   */
  authenticate(request: Request): Promise<Principal | null>;
}
