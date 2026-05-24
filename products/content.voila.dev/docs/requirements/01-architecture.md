# 01 — Architecture

## Repo layout

Bun workspaces monorepo, organized by product. Each product owns its own `apps/`, `packages/`, and `examples/` subtree under `products/<domain>/`. Anything that isn't tied to a single product (shared configs, ADRs) lives at the repo root. See [ADR 0001](../../../../docs/decision-records/0001-monorepo-and-package-naming.md) for the full rationale.

```
voila/
├── products/
│   └── content.voila.dev/
│       ├── apps/
│       │   ├── playground/             # TanStack Start app exercising every feature
│       │   └── docs/                   # Documentation site (TanStack Start + MDX)
│       │
│       ├── packages/
│       │   ├── content/                # @voila/content — the framework entry
│       │   │   ├── src/
│       │   │   │   ├── define.ts       # defineCollection, defineSingleton
│       │   │   │   ├── vite.ts         # voila() vite plugin (subpath: @voila/content/vite)
│       │   │   │   ├── admin/          # admin route options + React components
│       │   │   │   ├── server-routes/  # server file route handlers (health, REST, MCP HTTP)
│       │   │   │   ├── server-fns/     # createServerFn-based typed RPC (mutations)
│       │   │   │   ├── auth/           # Better Auth wiring (session + RBAC)
│       │   │   │   └── runtime/        # query, mutation, hooks
│       │   │   └── package.json
│       │   │
│       │   ├── schema/                 # @voila/content-schema — field constructors, Standard Schema derivation
│       │   │   └── src/fields/         # string, number, array, json, relation, media...
│       │   │
│       │   ├── ui/                     # @voila/content-ui — design system
│       │   │   ├── src/primitives/     # Base UI primitives wrapped
│       │   │   ├── src/components/     # shadcn-style composed components
│       │   │   ├── src/icons/          # Phosphor re-exports
│       │   │   ├── src/tokens.css      # CSS variables (colors, radii, spacing)
│       │   │   └── tailwind.config.ts
│       │   │
│       │   ├── database/               # @voila/content-database — Drizzle adapter
│       │   │   ├── src/adapters/d1.ts
│       │   │   ├── src/adapters/postgres.ts
│       │   │   ├── src/adapters/sqlite.ts
│       │   │   └── src/migrate.ts      # schema → migration generator
│       │   │
│       │   ├── storage/                # @voila/content-storage — media abstraction
│       │   │   ├── src/adapters/r2.ts
│       │   │   ├── src/adapters/s3.ts
│       │   │   └── src/transforms.ts   # image/video pipeline
│       │   │
│       │   ├── client/                 # @voila/content-client — typed API client (browser + server)
│       │   ├── cli/                    # @voila/content-cli — `voila` CLI (init, migrate, seed)
│       │   ├── mcp/                    # @voila/content-mcp — MCP server bridging the API
│       │   ├── i18n/                   # @voila/content-i18n — Paraglide/Inlang sync (site layer)
│       │   └── extensions/             # @voila/content-extensions — widget/page/task/cron API
│       │
│       ├── examples/                   # example consumers used in docs
│       └── docs/                       # product-specific design docs (this directory)
│
├── packages/                           # cross-product shared packages (no product prefix)
│   ├── typescript-config/              # @voila/typescript-config — shared tsconfig bases
│   ├── ui/                             # @voila/ui — shadcn-based design system
│   ├── rich-text-editor/               # @voila/rich-text-editor — Plate/Slate editor behavior + serialization
│   └── rich-text-nodes/                # @voila/rich-text-nodes — default React node components (presentation)
│
├── docs/
│   └── decision-records/               # org-wide ADRs
│
├── .changeset/
├── .github/
├── package.json                        # Bun workspaces root
├── biome.json
└── lefthook.yml
```

## Runtime architecture

```
                ┌────────────────────────────────────────┐
                │      Your TanStack Start app           │
                │                                        │
                │   content.config.ts                    │
                │   └─ export default defineContent({…}) │
                │            ▲                           │
                │            │ auto-discovered           │
                │            │                           │
                │   vite.config.ts                       │
                │   └─ voila()                           │
                │            │                           │
                │            ▼                           │
                │   ┌──────────────────────────────┐     │
                │   │  Virtual route tree (Vite)   │     │
                │   │   /admin/*   → admin routes  │     │
                │   │   /admin/api/* → server      │     │
                │   │                  file routes │     │
                │   └──────────────────────────────┘     │
                │            │                           │
                │            ▼                           │
                │   ┌──────────────────────────────┐     │
                │   │  TanStack Router + Start     │     │
                │   │  (routing, SSR, server fns)  │     │
                │   └──────────────────────────────┘     │
                └─────────────────┬──────────────────────┘
                                  │
                                  ▼
                ┌────────────────────────────────────────┐
                │           @voila/content               │
                │                                        │
                │   admin/          server-routes/       │
                │   ├ AdminShell    ├ health             │
                │   ├ SetupPage     ├ rest (M1+)         │
                │   └ collection    └ mcp (M6)           │
                │     pages (M1+)                        │
                │                                        │
                │   server-fns/     virtual:voila/content│
                │   (typed RPC      (re-exports the      │
                │    mutations)      user's config)      │
                └────────┬──────────────────┬────────────┘
                         │                  │
            ┌────────────┘                  └────────────┐
            ▼                                            ▼
    ┌─────────────────────────┐              ┌──────────────────┐
    │ @voila/content-database │              │ @voila/storage   │
    │        (Drizzle)        │              │  (R2 / S3)       │
    └────────────┬────────────┘              └────────┬─────────┘
                 │                                    │
                 ▼                                    ▼
        Cloudflare D1                          Cloudflare R2
        Postgres                               Any S3-compatible
        SQLite
```

## Single integration point

`@voila/content` integrates as a **vite plugin** plus a conventional
**`content.config.ts`** at the project root. Add the plugin to
`vite.config.ts`, drop the config file next to it, and the entire admin
route tree is registered as virtual routes inside TanStack Start — no
`app/routes/admin/*` files to author.

```ts
// content.config.ts — auto-discovered by the plugin
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

The plugin contributes three things to the consumer's app:

- **Virtual client routes** under `mount.admin` — admin splat, setup, and
  (in M1+) per-collection list/detail pages.
- **Virtual server file routes** under `mount.api` — healthcheck in M0,
  REST endpoints and HTTP MCP in later milestones.
- **A `virtual:voila/content` module** that re-exports `content.config.ts`
  so runtime code (admin components, server functions, the typed client)
  imports from a stable specifier regardless of where the user's config
  file lives.

The same `content.config.ts` is consumed by the CLI (`voila migrate`,
`voila seed`), the standalone MCP stdio binary, and the consumer's own
site code (e.g., `import content from "~/content.config"` in a public
route loader).

Override semantics:

- A same-named file in the consumer's `app/routes/` wins over a virtual
  route, so any admin page can be replaced surgically.
- `voila({ config: "./other.config.ts" })` overrides the default
  discovery path; `voila({ config: definedContent })` accepts an
  inline object for multi-tenant setups.

For consumers who can't use the plugin at all, the same components and
handlers are exported as factory helpers — see
[08 — Extensions](./08-extensions.md). See
[ADR 0002](../../../../docs/decision-records/0002-tanstack-start-integration.md)
for the full design rationale.

## Data flow: a typical write

```
1. User edits a Post in the admin                                  (browser)
2. TanStack Form validates against the schema-derived validator    (browser)
3. TanStack DB optimistic mutation updates the local store         (browser)
4. createServerFn (or POST /admin/api/posts/:id) carries the diff  (browser → worker)
5. Handler authenticates, authorizes (RBAC), re-validates          (worker)
6. Drizzle UPDATE on D1; media URLs resolved against R2            (worker)
7. Webhooks + cache invalidation queued via Cloudflare Queues      (worker)
8. Response returns the canonical doc; TanStack DB reconciles      (browser)
9. Live preview channel (Durable Object) notifies subscribers      (worker → browser)
```

Mutations from the admin use TanStack Start `createServerFn` for typed
RPC; REST endpoints under `mount.api` are the same operations exposed
for non-TS consumers. Both share identical validation, hooks, and RBAC
logic — they're thin transport wrappers around the same resolvers.

## Why not a standalone server?

We considered it. Three reasons we didn't:

1. **Deploy story**: one binary, one URL, one auth surface.
2. **Type sharing**: `import content from '~/content.config'` works in
   the public site, the admin, and the CLI. No codegen.
3. **TanStack Start already gives us 80% of a CMS server** (routing,
   RPC, SSR, edge deploy). We commit to it as the integration substrate
   — see [ADR 0002](../../../../docs/decision-records/0002-tanstack-start-integration.md).

## What's NOT in scope

- Visual page builder (use blocks + rich text)
- Marketing site builder (this is a CMS, not Webflow)
- Hosted SaaS tier (run it yourself; pay Cloudflare, not us)

---

Continue → [02 — Quick Start](./02-quick-start.md)
