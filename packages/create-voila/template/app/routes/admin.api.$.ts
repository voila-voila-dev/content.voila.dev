// The /admin/api mount. Requests under /admin/api/auth/* are served by Better
// Auth (sign-in, magic-link verify, sign-out); everything else forwards to the
// voila REST handler, which routes per-collection reads and writes itself.
//
// Reads also seed the CSRF cookie: the first response a caller without one gets
// carries a signed `voila_csrf` token. The typed client mirrors it into the
// `x-csrf-token` header on writes, satisfying the engine's double-submit check.

import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_COOKIE_NAME, issueCsrfToken, readCookie } from "@voila/content/server";
import { auth, authSecret, restHandler } from "../lib/server";

async function handle({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/admin/api/auth")) {
    return auth.handler(request);
  }

  const response = (await restHandler(request)) ?? new Response("Not found", { status: 404 });

  // Hand the caller a CSRF token if they don't have one yet. Non-HttpOnly so the
  // client can read it (the double-submit pattern); Lax + the session cookie do
  // the actual cross-site blocking.
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
}

export const Route = createFileRoute("/admin/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      PUT: handle,
      DELETE: handle,
    },
  },
});
