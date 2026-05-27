/**
 * API-level session enforcement. Every `/admin/api/*` data handler (reads and
 * writes) runs `requireApiSession` first, so the REST surface is protected on
 * its own — not just behind the admin UI layout's `beforeLoad`. A request
 * without a valid session gets a `401 UNAUTHORIZED` envelope.
 *
 * The handlers depend only on the structural `ApiSessionResolver` interface,
 * never on `better-auth` directly — the generated route files inject a resolver
 * backed by the auth singleton (`getSessionSafe(getAuth(), request)`). Keeping
 * the dependency structural means `@voila/content-auth` stays an optional peer
 * and the handlers stay unit-testable with a tiny fake resolver.
 *
 * When no resolver is injected, enforcement is skipped (the handler runs
 * unauthenticated). That keeps the data-logic tests free of auth scaffolding;
 * the generated routes always inject a resolver, so the deployed API is gated.
 */

import { err, ok, type Result } from "../shared/result.ts";
import { type UnauthorizedError, unauthorized } from "./errors.ts";
import type { HandlerContext } from "./handlers/shared.ts";

export type { ApiSessionResolver } from "./handlers/shared.ts";

/**
 * Gate a handler on an authenticated session. Returns the resolved session on
 * success (handlers can thread it into audit/RBAC later), `ok(null)` when no
 * resolver is wired, or an `UNAUTHORIZED` failure when a resolver is present
 * but yields no session.
 */
export async function requireApiSession(
  ctx: Pick<HandlerContext, "request" | "auth">,
): Promise<Result<unknown, UnauthorizedError>> {
  if (!ctx.auth) return ok(null);
  const session = await ctx.auth.getSession(ctx.request);
  if (!session) return err(unauthorized());
  return ok(session);
}
