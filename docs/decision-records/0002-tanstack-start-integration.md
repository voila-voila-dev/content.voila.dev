# ADR 0002 — TanStack Start as the integration substrate

**Accepted · 2026-05-22**

## Context

`@voila/content` mounts inside an existing TanStack Start application.
Three integration models were on the table:

1. **Opaque request handler.** Expose a single
   `content.handle(request): Promise<Response>` Web-API handler. The
   consumer wires one catch-all `app/routes/admin/$.ts` that delegates
   every method to it. The CMS is a black box; portability is the win
   (Hono, raw Workers, Node + `@whatwg-node`, anywhere Fetch runs).
2. **Route module pack.** Ship TanStack Router route options and
   TanStack Start server file route handlers; consumers compose one-line
   re-export files (`app/routes/admin/$.tsx`, `app/routes/admin/api/health.ts`, …)
   in their tree.
3. **Vite plugin.** Ship a vite plugin that registers the admin route
   tree as **virtual routes** in the consumer's TanStack Start app. The
   consumer adds one line to `vite.config.ts` and writes zero route
   files. Same DX shape as Astro integrations or Nuxt modules.

The M0 PR initially shipped (1), with the admin shell already
re-implemented as JSX via `renderToStaticMarkup`.

## Decision

Adopt the vite plugin model. `@voila/content` ships a vite plugin at
the `@voila/content/vite` subpath. Content lives in a conventional
`content.config.ts` at the project root which the plugin auto-discovers;
explicit overrides are accepted but unusual.

Factory helpers (`adminRouteOptions(content)`, `healthGET`, …) stay
exported for the escape hatch — for consumers who can't use the plugin
(custom build, multi-tenant dispatch, etc.).

The basic setup is **one plugin line + one config file**:

```ts
// content.config.ts (project root) — auto-discovered by the plugin
import { defineContent } from "@voila/content";
import { d1 } from "@voila/content-database/d1";
import { r2 } from "@voila/storage/r2";

import { posts, authors } from "./app/content/collections";
import { siteSettings } from "./app/content/singletons";

export default defineContent({
  branding: { name: "Acme CMS", accent: "#FF6A00" },
  collections: [posts, authors],
  singletons: [siteSettings],
  database: d1({ binding: "DATABASE" }),
  storage: r2({ bucket: "media" }),
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { voila } from "@voila/content/vite";

export default defineConfig({
  plugins: [
    voila(),       // auto-discovers ./content.config.ts
    tanstackStart(),
  ],
});
```

Overrides (rare): `voila({ config: "./path/to/config.ts" })` to
point at a non-default path, or `voila({ config: definedContent })`
to pass an inline object (escape hatch for multi-tenant setups).

The plugin contributes:

- **Virtual client routes** under `mount.admin` (admin splat, setup, and
  per-collection list/detail pages as they land).
- **Virtual server file routes** under `mount.api` (healthcheck, REST,
  HTTP MCP).
- **Type generation hooks** so the TanStack Router route tree includes
  our paths and `<Link to="/admin/posts/$id" />` typechecks in consumer
  code.
- **A `virtual:voila/content` module** that re-exports the user's
  `content.config.ts` to runtime code (admin components, server
  functions, the typed client). Runtime modules import from the virtual
  module rather than depending on the user's file path.
- **HMR**: edits to `content.config.ts` (or files it transitively
  imports) invalidate the virtual route modules and trigger a
  route-tree regeneration.

Escape-hatch DX (documented under "Advanced", not in quick-start):

```tsx
// app/routes/admin/$.tsx
import { createFileRoute } from "@tanstack/react-router";
import { adminRouteOptions } from "@voila/content/admin";
import content from "~/content.config";

export const Route = createFileRoute("/admin/$")(adminRouteOptions(content));
```

`content.handle(request)` is removed from the public surface.

## Why a conventional file + a plugin?

- **One concept, two files.** `content.config.ts` is the schema source
  of truth; `vite.config.ts` is the build wiring. Each does one job.
  Mixing config into `vite.config.ts` mingles content authoring with
  build setup.
- **The convention is universally recognized.** `tailwind.config.ts`,
  `drizzle.config.ts`, `astro.config.mjs`, `next.config.js` — every
  framework in this stack lives at the root with a predictable name.
  Following the pattern means no documentation needed for the file
  path.
- **Type ergonomics.** A `content.config.ts` that's just
  `export default defineContent({ … })` gets full IDE support — go-to-def,
  hover types, autocomplete on field defs — without the plugin having
  to project types through `vite.config.ts` (which it can't, easily).
- **Importable from non-vite contexts.** The MCP stdio binary, CLI
  commands (`voila migrate`, `voila seed`), and tests need to read the
  same config. A plain `.ts` file is trivially importable from all of
  them; a config buried in vite plugin options is not.

## Consequences

**Wins:**

- Zero route files in the consumer's `app/routes/` tree. One plugin
  line, no route-pack boilerplate.
- Typed routing inherited from TanStack Router.
- Mutations via `createServerFn` — typed RPC server→client without a
  bespoke `@voila/client` wrapper.
- Loader / pending / error boundaries / prefetching come from TS Start.
- One React tree, one router. The admin inherits the consumer's root
  layout if desired.
- Consumer overrides remain file-based: a same-named file in the
  consumer's `app/routes/` wins over a virtual route.
- `content.config.ts` is consumable by the CLI, MCP stdio binary, and
  the consumer's site code (e.g., `import content from "~/content.config"`
  in a public route loader).

**Costs:**

- Hard coupling to TanStack Start. `@tanstack/react-start`,
  `@tanstack/react-router`, and `vite` are required peer dependencies
  for the plugin entry point. Non-TS Start consumers are unsupported.
- TanStack Start is pre-1.0. Breaking changes upstream are CMS breaking
  changes.
- Virtual routes depend on TanStack Router's `virtualRouteConfig` API.
  If that API churns, our plugin churns.
- The MCP server's stdio transport cannot route through TS Start. The
  stdio path ships as a separate `bunx voila mcp` binary that imports
  `content.config.ts` directly. HTTP MCP remains a virtual server file
  route.

## Alternatives considered

- **Opaque request handler (Level 1).** Rejected — leaves all framework
  benefits (typed `<Link>`, loaders, `createServerFn`) on the table.
- **Route module pack without a plugin (Level 2).** Rejected — consumer
  writes a stub file per route surface. Acceptable but inferior DX, and
  a `voila init` CLI would have to mask the boilerplate anyway.
- **Inline config in plugin options (no `content.config.ts`).** Briefly
  considered. Rejected — types don't project cleanly into
  `vite.config.ts`, the CLI/MCP stdio paths still need a file to import,
  and "schema authoring inside build config" mingles two concerns.
- **Custom router + RPC + SSR.** Rejected — we'd ship a worse copy of
  TanStack Start.

## Migration

This ADR is accepted alongside the M0 PR that introduces
`packages/content`. No published version of `@voila/content` exists yet,
so no consumer migration is required. The PR is updated to:

1. Drop `content.handle(request)` from the public surface.
2. Keep `defineContent`, `defineCollection`, `defineSingleton` as the
   declaration helpers; `defineContent` becomes the entry point of
   `content.config.ts`.
3. Add `adminRouteOptions(content)`, `setupRouteOptions(content)`,
   `healthGET` factories (escape hatch).
4. Add the `@voila/content/vite` subpath with a vite-plugin stub that
   auto-discovers `./content.config.ts`, registers the M0 virtual routes
   (admin splat, setup, health), and exposes `virtual:voila/content`.
