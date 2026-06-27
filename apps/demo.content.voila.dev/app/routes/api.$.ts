// The /api mount. Auth routes (/api/auth/*) are served locally by Better Auth
// against the shared D1. Every other content request is forwarded to the signed-in
// user's sandbox Durable Object (its own isolated SQLite), with the resolved
// principal injected as a trusted `x-voila-principal` header. The CSRF cookie is
// still minted at the edge on first read (same secret the DO verifies writes with).

import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_COOKIE_NAME, issueCsrfToken, readCookie } from "@voila/content/server";
import { runtime } from "../lib/server";

async function handle({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);

  // Auth stays local (Better Auth on shared D1). Match the base path on a segment
  // boundary so a collection like `authors` isn't mistaken for `/api/auth`.
  const authBase = runtime.auth.basePath;
  if (url.pathname === authBase || url.pathname.startsWith(`${authBase}/`)) {
    return runtime.auth.handler(request);
  }

  // Resolve the session against D1; the REST guard would 401 anyway without one.
  const principal = await runtime.auth.authenticator.authenticate(request);
  if (!principal) return new Response("Unauthorized", { status: 401 });

  // Forward to the caller's sandbox DO. Strip any client-supplied principal header
  // before injecting the trusted one, and preserve cookies + CSRF header + body.
  const headers = new Headers(request.headers);
  headers.delete("x-voila-principal");
  headers.set(
    "x-voila-principal",
    JSON.stringify({ id: principal.id, email: principal.email, roles: principal.roles }),
  );
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const forwarded = new Request(request.url, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // Streamed bodies (e.g. multipart media uploads) require `duplex` on Workers.
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);

  const stub = env.SANDBOX.get(env.SANDBOX.idFromName(principal.id));
  const response = await stub.fetch(forwarded);

  // Seed the CSRF cookie on the first read so the client can echo it on writes.
  if (!readCookie(request, DEFAULT_COOKIE_NAME)) {
    const token = await issueCsrfToken(runtime.authSecret);
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

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle },
  },
});
