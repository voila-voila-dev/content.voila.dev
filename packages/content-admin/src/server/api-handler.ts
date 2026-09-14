// The `/admin/api` mount, framework-owned. Requests under the auth base path
// (`/admin/api/auth/*`) are served by Better Auth (sign-in, magic-link verify,
// sign-out); everything else forwards to the voila REST handler.
//
// When the access policy can decide from an email alone (`policy.admits`), the
// magic-link sign-in is gated here: an address the policy rejects gets a 403
// before any email is sent, which the login screen renders as "not allowed".
//
// Reads also seed the CSRF cookie: the first response a caller without one gets
// carries a signed `voila_csrf` token. The typed client mirrors it into the
// `x-csrf-token` header on writes, satisfying the engine's double-submit check.
//
// This is the verbatim logic the demo hand-wrote in `app/routes/admin.api.$.ts`,
// now derived from the runtime so every site's API route is a one-line shim.

import { DEFAULT_COOKIE_NAME, issueCsrfToken, readCookie } from "@voila/content/server";
import type { AdminRuntime } from "./runtime";

/**
 * Build the request handler the host's `admin.api.$.ts` route delegates to.
 * Returns a `(request) => Response` that never returns null — an unmatched REST
 * route folds to a 404 so the route owns the whole `/admin/api/*` space.
 */
export function createApiHandler(
  runtime: Pick<AdminRuntime, "auth" | "restHandler" | "authSecret"> &
    Partial<Pick<AdminRuntime, "policy">>,
): (request: Request) => Promise<Response> {
  const { auth, restHandler, authSecret } = runtime;
  const admits = runtime.policy?.admits;
  const signInPath = `${auth.basePath}/sign-in/magic-link`;
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    // Match the auth base path on a segment boundary so a collection whose slug
    // starts with the base (e.g. `authors` under `/api/auth`) isn't swallowed.
    if (url.pathname === auth.basePath || url.pathname.startsWith(`${auth.basePath}/`)) {
      if (admits !== undefined && request.method === "POST" && url.pathname === signInPath) {
        const email = await readSignInEmail(request);
        if (email === undefined || !(await admits(email))) {
          return Response.json(
            { error: { code: "FORBIDDEN" }, message: "This address is not allowed to sign in." },
            { status: 403 },
          );
        }
      }
      return auth.handler(request);
    }

    const response = (await restHandler(request)) ?? new Response("Not found", { status: 404 });

    if (!readCookie(request, DEFAULT_COOKIE_NAME)) {
      const token = await issueCsrfToken(authSecret);
      const secure = url.protocol === "https:" ? "; Secure" : "";
      const out = new Response(response.body, response);
      out.headers.append(
        "set-cookie",
        `${DEFAULT_COOKIE_NAME}=${token}; Path=/; SameSite=Lax${secure}`,
      );
      return out;
    }
    return response;
  };
}

/** The `email` of a magic-link sign-in body, or undefined when absent/malformed. */
async function readSignInEmail(request: Request): Promise<string | undefined> {
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  return typeof body?.email === "string" ? body.email : undefined;
}
