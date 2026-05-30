// The `Auth` service seam + the per-request session it resolves. The engine
// depends on this tag, never on better-auth directly — so `BetterAuthLive` can
// be swapped for Clerk, a custom JWT layer, or a test double without touching
// any consumer (`./middleware`, the host's `/admin/api/auth/*` route).

import { Context, type Effect, Schema } from "effect";
import type { Unauthorized } from "./errors";

/** The resolved identity for an authenticated request. */
export class AuthSession extends Schema.Class<AuthSession>("@voila/content-auth/AuthSession")({
  userId: Schema.String,
  email: Schema.String,
  expiresAt: Schema.DateFromSelf,
}) {}

export interface AuthService {
  /** Resolve the session for a request, or `null` when absent. Fails soft. */
  readonly getSession: (request: Request) => Effect.Effect<AuthSession | null>;
  /** Resolve the session, failing `Unauthorized` when absent. */
  readonly requireSession: (request: Request) => Effect.Effect<AuthSession, Unauthorized>;
  /** Handle a request for the `/admin/api/auth/*` catch-all (sign-in, verify, …). */
  readonly handler: (request: Request) => Effect.Effect<Response>;
}

export class Auth extends Context.Tag("@voila/content-auth/Auth")<Auth, AuthService>() {}

/** The session provided into authed RPC/HTTP handlers by the session middleware. */
export class CurrentSession extends Context.Tag("@voila/content-auth/CurrentSession")<
  CurrentSession,
  AuthSession
>() {}
