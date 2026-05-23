/**
 * Source generators for the REST read routes. Each emits a thin TanStack server
 * route file: it reads the D1 binding off the worker `env`, wraps it in the
 * adapter, and delegates to the matching `@voila/content/server` handler. All
 * query/pagination/error logic lives in the handler, not here.
 *
 * `configImport` is the relative specifier the generated file uses to import the
 * consumer's `content.config.ts` default export (computed by the vite plugin).
 */

/** `GET /admin/api/:collection` — cursor-paginated list. */
export function adminApiListSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
import { handleList } from "@voila/content/server";
import content from "${configImport}";

export const Route = createFileRoute("/admin/api/$collection")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleList({ request, params, content, adapter: d1FromBinding(env.DATABASE) }),
    },
  },
});
`;
}

/** `GET /admin/api/:collection/:id` — find by id. */
export function adminApiByIdSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { d1FromBinding } from "@voila/content-database/d1";
import { handleFindById } from "@voila/content/server";
import content from "${configImport}";

export const Route = createFileRoute("/admin/api/$collection/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleFindById({ request, params, content, adapter: d1FromBinding(env.DATABASE) }),
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
import { handleFindByField } from "@voila/content/server";
import content from "${configImport}";

export const Route = createFileRoute("/admin/api/$collection/by/$field/$value")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleFindByField({ request, params, content, adapter: d1FromBinding(env.DATABASE) }),
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
