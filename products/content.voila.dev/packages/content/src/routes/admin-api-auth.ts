/**
 * Source generators for the Better Auth catch-all route + the auth-instance
 * singleton shared by the API handler and the layout middleware. Codegen
 * lives here instead of `admin-api.ts` because the auth surface depends on
 * the optional `@voila/content-auth` peer dep and shouldn't leak into the
 * core read-API generator.
 *
 * The singleton file uses a module-scope `let` so the Better Auth instance
 * is constructed once per worker isolate, not per request — wiring up
 * Drizzle for every fetch would be wasteful and would re-create the cookie
 * keys on every call.
 */

/**
 * `admin/auth-server.ts` — the singleton factory shared by the API route and
 * the layout's `beforeLoad`. Centralizing it avoids a circular import and
 * means env access happens in exactly one place.
 */
export function authSingletonSource(configImport: string): string {
  return `import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
import { createAuth } from "@voila/content-auth/server";
import { resolveAuthConfig } from "@voila/content-auth";
import content from "${configImport}";

let cached: ReturnType<typeof createAuth> | undefined;

/**
 * Lazily build a Better Auth instance bound to the worker's D1 binding +
 * \`VOILA_AUTH_SECRET\` env var. Idempotent: subsequent calls hand back the
 * same instance so cookie keys + the drizzle adapter survive across requests.
 *
 * Auth configuration is read from \`content.auth\` (see \`content.config.ts\`)
 * and normalized via \`resolveAuthConfig\`, so user-supplied \`providers\`,
 * \`sessionTtl\`, \`roles\`, \`email\`, and the \`authentication\` escape hatch
 * all flow through to \`createAuth\`.
 */
export function getAuth(): ReturnType<typeof createAuth> {
  if (cached) return cached;
  const e = env as Record<string, unknown>;
  const secret = e.VOILA_AUTH_SECRET;
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error(
      "VOILA_AUTH_SECRET is not set. Add it to .dev.vars (local) or wrangler secrets (deployed).",
    );
  }
  // Base URL is required so Better Auth can sign cookie attributes (Secure,
  // domain) correctly. Prefer auth.baseUrl from content.config, fall back to
  // VOILA_BASE_URL env, fall back to the canonical dev URL. Production
  // deployments set the env var via wrangler secrets.
  const baseUrl =
    content.auth?.baseUrl ??
    (typeof e.VOILA_BASE_URL === "string" ? e.VOILA_BASE_URL : undefined) ??
    "http://localhost:8787";
  cached = createAuth({
    config: resolveAuthConfig(content.auth),
    adapter: d1FromBinding(e.DATABASE),
    secret,
    env: e as Record<string, string | undefined>,
    brand: content.branding?.name,
    baseUrl,
  });
  return cached;
}
`;
}

/**
 * `/admin/api/auth/$.ts` — catch-all that forwards every method to the
 * Better Auth handler. The `$` splat covers every nested path
 * (`/admin/api/auth/sign-in/magic-link`, `/admin/api/auth/session`, …) so
 * Better Auth owns its own routing under the prefix.
 */
export function adminApiAuthSplatSource(): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "../../-auth-server";

const handle = ({ request }: { request: Request }) => getAuth().handler(request);

export const Route = createFileRoute("/admin/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      PUT: handle,
      DELETE: handle,
      OPTIONS: handle,
    },
  },
});
`;
}
