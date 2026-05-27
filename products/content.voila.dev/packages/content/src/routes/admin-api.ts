/**
 * Source generators for the REST routes. Each emits a thin TanStack server
 * route file: it reads the D1 binding off the worker `env`, wraps it in the
 * adapter, wires the session resolver to the auth singleton, and delegates to
 * the matching `@voila/content/server` handler. All query/validation/error
 * logic lives in the handler, not here.
 *
 * Every data route (reads and writes) injects `auth` so the API enforces a
 * session on its own (`401` without one) — not just behind the admin UI
 * layout. Write routes additionally pass `csrfSecret` (the deployment's
 * `VOILA_AUTH_SECRET`) so the handler can verify the signed double-submit
 * token.
 *
 * `configImport` is the relative specifier the generated file uses to import the
 * consumer's `content.config.ts` default export (computed by the vite plugin).
 */

// Shared preamble lines for the data routes. `getAuth` resolves the auth
// singleton lazily (per request, cached), so importing it here is side-effect
// free; `csrfSecret` reads the worker secret once at module scope.
const AUTH_IMPORT = `import { getSessionSafe } from "@voila/content-auth/middleware";`;
const AUTH_SINGLETON_IMPORT = `import { getAuth } from "../-auth-server";`;
const AUTH_CONST = `const auth = { getSession: (request: Request) => getSessionSafe(getAuth(), request) };`;
const CSRF_SECRET_CONST = `const csrfSecret = String(env.VOILA_AUTH_SECRET ?? "");`;

/**
 * `/admin/api/:collection` — `GET` lists (cursor-paginated), `POST` creates.
 */
export function adminApiListSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
${AUTH_IMPORT}
import { handleCreate, handleList } from "@voila/content/server";
import content from "${configImport}";
${AUTH_SINGLETON_IMPORT}

${AUTH_CONST}
${CSRF_SECRET_CONST}

export const Route = createFileRoute("/admin/api/$collection")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleList({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth }),
      POST: ({ request, params }) =>
        handleCreate({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth, csrfSecret }),
    },
  },
});
`;
}

/**
 * `/admin/api/:collection/:id` — `GET` finds by id, `PATCH` updates,
 * `DELETE` soft-deletes (`?hard=true` purges).
 */
export function adminApiByIdSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
${AUTH_IMPORT}
import { handleDelete, handleFindById, handleUpdate } from "@voila/content/server";
import content from "${configImport}";
${AUTH_SINGLETON_IMPORT}

${AUTH_CONST}
${CSRF_SECRET_CONST}

export const Route = createFileRoute("/admin/api/$collection/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleFindById({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth }),
      PATCH: ({ request, params }) =>
        handleUpdate({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth, csrfSecret }),
      DELETE: ({ request, params }) =>
        handleDelete({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth, csrfSecret }),
    },
  },
});
`;
}

/** `POST /admin/api/:collection/:id/restore` — clear a soft delete. */
export function adminApiRestoreSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
${AUTH_IMPORT}
import { handleRestore } from "@voila/content/server";
import content from "${configImport}";
${AUTH_SINGLETON_IMPORT}

${AUTH_CONST}
${CSRF_SECRET_CONST}

export const Route = createFileRoute("/admin/api/$collection/$id/restore")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleRestore({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth, csrfSecret }),
    },
  },
});
`;
}

/**
 * `GET /admin/api/csrf` — issue the signed double-submit CSRF token + cookie.
 * No DB binding or session needed (public): the token is bound to the server
 * secret, not the session. Reads `VOILA_AUTH_SECRET` to sign.
 */
export function adminApiCsrfSource(): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { handleCsrfToken } from "@voila/content/server";

${CSRF_SECRET_CONST}

export const Route = createFileRoute("/admin/api/csrf")({
  server: {
    handlers: {
      GET: ({ request }) => handleCsrfToken({ request, csrfSecret }),
    },
  },
});
`;
}

/** `GET /admin/api/:collection/by/:field/:value` — find by a unique field. */
export function adminApiByFieldSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
${AUTH_IMPORT}
import { handleFindByField } from "@voila/content/server";
import content from "${configImport}";
${AUTH_SINGLETON_IMPORT}

${AUTH_CONST}

export const Route = createFileRoute("/admin/api/$collection/by/$field/$value")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleFindByField({ request, params, content, adapter: d1FromBinding(env.DATABASE), auth }),
    },
  },
});
`;
}

/**
 * Ambient declaration for the `cloudflare:workers` virtual module so the
 * generated routes type-check without `wrangler types`. Emitted only when the
 * consumer has no `worker-configuration.d.ts` of their own (see the vite
 * plugin) — once they run `wrangler types`, theirs wins and we stop emitting
 * this to avoid a duplicate-declaration clash.
 */
export function cloudflareEnvDeclSource(): string {
  return `declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
`;
}
