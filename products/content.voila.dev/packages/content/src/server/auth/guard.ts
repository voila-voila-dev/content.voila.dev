// The request guard that runs *before* a matched REST handler: authenticate,
// then (for mutating routes) check CSRF, then run the RBAC hook. Each seam is
// optional — omit `auth` and the API is open; omit `csrf` and writes aren't
// double-submit-checked — so the guard is a no-op until a host opts in, keeping
// the existing read/write handlers and their tests unchanged.
//
// Returns the denial `Response` (a typed error envelope) for the first failing
// check, or `null` to let the request proceed. The dispatcher in `rest/router`
// calls this between matching a route and invoking its handler.

import { csrfFailure, errorResponse, forbidden, unauthorized } from "../rest/errors";
import type { AccessControl } from "./access";
import type { Authenticator } from "./authenticator";
import { type CsrfOptions, verifyCsrf } from "./csrf";
import type { Operation, Principal } from "./principal";

export interface GuardOptions {
  /** Identity seam. When set, every request must resolve to a `Principal`. */
  readonly auth?: Authenticator;
  /** RBAC hook. Consulted only for authenticated requests (needs `auth`). */
  readonly access?: AccessControl;
  /** CSRF double-submit config. When set, mutating routes are token-checked. */
  readonly csrf?: CsrfOptions;
}

/** What the router knows about a matched route, for the access hook. */
export interface RouteDescriptor {
  readonly operation: Operation;
  readonly collection: string;
  readonly documentId?: string;
}

// Operations that change state and therefore carry CSRF protection. Reads are
// exempt — they're safe to issue cross-site and don't mutate anything.
const MUTATING: ReadonlySet<Operation> = new Set(["create", "update", "delete", "restore"]);

/**
 * Run the auth → CSRF → access pipeline for a matched route. Order matters:
 * authenticate first so an unauthenticated caller gets a 401 without learning
 * whether the collection or document exists; CSRF before the RBAC hook so a
 * forged write is rejected regardless of the principal's rights.
 */
export async function authorizeRequest(
  request: Request,
  route: RouteDescriptor,
  options: GuardOptions,
): Promise<Response | null> {
  let principal: Principal | null = null;
  if (options.auth) {
    principal = await options.auth.authenticate(request);
    if (principal === null) return errorResponse(unauthorized());
  }

  if (options.csrf && MUTATING.has(route.operation)) {
    const ok = await verifyCsrf(request, options.csrf);
    if (!ok) return errorResponse(csrfFailure());
  }

  // The RBAC hook authorizes a known principal; without `auth` there's none to
  // authorize, so it's skipped (a host wiring `access` is expected to wire `auth`).
  if (options.access && principal !== null) {
    const allowed = await options.access({
      principal,
      operation: route.operation,
      collection: route.collection,
      documentId: route.documentId,
    });
    if (!allowed) return errorResponse(forbidden(route.collection, route.operation));
  }

  return null;
}
