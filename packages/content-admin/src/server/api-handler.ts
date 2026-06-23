// The `/admin/api` mount, framework-owned. Requests under the auth base path
// (`/admin/api/auth/*`) are served by Better Auth (sign-in, magic-link verify,
// sign-out); everything else forwards to the voila REST handler.
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
  runtime: Pick<AdminRuntime, "auth" | "restHandler" | "authSecret">,
): (request: Request) => Promise<Response> {
  const { auth, restHandler, authSecret } = runtime;
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname.startsWith(auth.basePath)) {
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
