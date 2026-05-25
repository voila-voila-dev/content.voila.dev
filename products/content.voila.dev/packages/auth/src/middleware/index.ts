/**
 * Session middleware used by the generated `/admin` layout. Inspects the
 * incoming request, asks better-auth for the active session, and emits a
 * `Redirect` descriptor when the request hits a protected path without one.
 *
 * The middleware deliberately returns a *descriptor* instead of throwing a
 * TanStack `redirect()` — keeping the helper framework-agnostic so the same
 * code unit-tests cleanly and so non-TanStack consumers (or future custom
 * adapters) can reuse it.
 */

import type { Auth } from "better-auth";

export interface RequireSessionOptions {
  /** Better Auth instance. */
  auth: Auth;
  /** Public paths that must remain reachable without a session. */
  publicPaths?: readonly string[];
  /** Where to send unauthenticated requests. Default `"/admin/login"`. */
  loginPath?: string;
}

/** Result of running the middleware against a single request. */
export type SessionGuard =
  | { kind: "allow"; session: AuthSession }
  | { kind: "anonymous" }
  | { kind: "redirect"; to: string };

/** The session shape better-auth's `api.getSession` resolves to (subset). */
export interface AuthSession {
  user: { id: string; email: string; name?: string | null };
  session: { id: string; expiresAt: Date | string };
}

const DEFAULT_PUBLIC_PATHS = ["/admin/login", "/admin/api/auth", "/admin/api/health"] as const;

/**
 * Resolve a request to a `SessionGuard`. Caller decides what to do with the
 * descriptor — TanStack callers translate `redirect` to `throw redirect()`,
 * tests just inspect the return value.
 */
export async function requireSession(
  request: Request,
  options: RequireSessionOptions,
): Promise<SessionGuard> {
  const { auth } = options;
  const url = new URL(request.url);

  if (isPublicPath(url.pathname, options.publicPaths)) {
    const session = await safeGetSession(auth, request.headers);
    return session ? { kind: "allow", session } : { kind: "anonymous" };
  }

  const session = await safeGetSession(auth, request.headers);
  if (session) return { kind: "allow", session };

  const loginPath = options.loginPath ?? "/admin/login";
  const next = encodeURIComponent(`${url.pathname}${url.search}`);
  return { kind: "redirect", to: `${loginPath}?next=${next}` };
}

function isPublicPath(pathname: string, extra?: readonly string[]): boolean {
  const all = [...(extra ?? []), ...DEFAULT_PUBLIC_PATHS];
  return all.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * `auth.api.getSession` throws when the cookie is malformed or absent. We
 * collapse both signals to a `null`, since the caller only cares whether a
 * usable session exists.
 */
async function safeGetSession(auth: Auth, headers: Headers): Promise<AuthSession | null> {
  try {
    const session = await auth.api.getSession({ headers });
    return (session as AuthSession | null) ?? null;
  } catch {
    return null;
  }
}
