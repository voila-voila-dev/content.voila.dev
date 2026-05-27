import { csrfSetCookie, isSecureRequest, issueCsrf } from "../csrf.ts";

/** Args for the CSRF token endpoint: the request plus the signing secret. */
export interface CsrfTokenContext {
  readonly request: Request;
  /** Secret the token is HMAC-signed with (the deployment's `VOILA_AUTH_SECRET`). */
  readonly csrfSecret: string;
}

/**
 * `GET /admin/api/csrf` — issue (or refresh) the signed double-submit CSRF
 * token.
 *
 * Returns `{ data: { token } }` and sets the `voila_csrf` cookie. The admin
 * client calls this once before its first write, then echoes the token in the
 * `x-voila-csrf` header on every `POST`/`PATCH`/`DELETE`. Reuses an existing
 * validly-signed cookie so the token stays stable across tabs; always re-sets
 * the cookie to refresh its `Max-Age`. Public on purpose — the token is bound
 * to the server secret, not the session, so handing one out pre-auth is
 * harmless (writes still require a session).
 */
export async function handleCsrfToken(ctx: CsrfTokenContext): Promise<Response> {
  const { token } = await issueCsrf(ctx.request, ctx.csrfSecret);
  return Response.json(
    { data: { token } },
    { headers: { "set-cookie": csrfSetCookie(token, { secure: isSecureRequest(ctx.request) }) } },
  );
}
