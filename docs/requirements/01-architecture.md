# 01 — Architecture

## Repo layout

Bun workspaces monorepo.

```
content.voila.dev/
├── apps/
│   ├── playground/             # TanStack Start app exercising every feature
│   └── docs/                   # Documentation site (TanStack Start + MDX)
│
├── packages/
│   ├── content/                # @voila/content — the framework entry
│   │   ├── src/
│   │   │   ├── define.ts       # defineContent, defineCollection, defineSingleton
│   │   │   ├── handler.ts      # the request handler mounted on the catch-all route
│   │   │   ├── admin/          # the admin React app (mounted by handler)
│   │   │   ├── api/            # REST/RPC route table
│   │   │   ├── auth/           # Better Auth wiring (session + RBAC)
│   │   │   └── runtime/        # query, mutation, hooks
│   │   └── package.json
│   │
│   ├── schema/                 # @voila/schema — field constructors, Standard Schema derivation
│   │   └── src/fields/         # string, number, array, json, relation, media...
│   │
│   ├── ui/                     # @voila/ui — design system
│   │   ├── src/primitives/     # Base UI primitives wrapped
│   │   ├── src/components/     # shadcn-style composed components
│   │   ├── src/icons/          # Phosphor re-exports
│   │   ├── src/tokens.css      # CSS variables (colors, radii, spacing)
│   │   └── tailwind.config.ts
│   │
│   ├── db/                     # @voila/db — Drizzle adapter
│   │   ├── src/adapters/d1.ts
│   │   ├── src/adapters/postgres.ts
│   │   ├── src/adapters/sqlite.ts
│   │   └── src/migrate.ts      # schema → migration generator
│   │
│   ├── storage/                # @voila/storage — media abstraction
│   │   ├── src/adapters/r2.ts
│   │   ├── src/adapters/s3.ts
│   │   └── src/transforms.ts   # image/video pipeline
│   │
│   ├── client/                 # @voila/client — typed API client (browser + server)
│   ├── cli/                    # @voila/cli — `voila` CLI (init, migrate, seed)
│   ├── mcp/                    # @voila/mcp — MCP server bridging the API
│   ├── i18n/                    # @voila/i18n — Paraglide/Inlang sync (site layer)
│   └── extensions/             # @voila/extensions — widget/page/task/cron API
│
├── docs/                       # Design docs (this directory)
├── package.json
├── bunfig.toml
├── tsconfig.base.json
└── biome.json
```

## Runtime architecture

```
                       ┌──────────────────────────────┐
                       │   Your TanStack Start app    │
                       │                              │
   /admin/*  ─────────►│  /admin/$.ts  ──► content.handle(request)
   /api/*    ─────────►│                              │
                       └────────────┬─────────────────┘
                                    │
                                    ▼
                       ┌──────────────────────────────┐
                       │      @voila/content          │
                       │                              │
                       │  ┌────────┐   ┌───────────┐  │
                       │  │ Router │──►│ Admin SPA │  │  ◄── mounted under /admin
                       │  └────────┘   └───────────┘  │
                       │  ┌────────┐   ┌───────────┐  │
                       │  │  API   │──►│ Resolvers │  │  ◄── mounted under /api
                       │  └────────┘   └───────────┘  │
                       │  ┌────────┐                  │
                       │  │  MCP   │                  │  ◄── mounted under /mcp
                       │  └────────┘                  │
                       └─────┬────────────┬───────────┘
                             │            │
                ┌────────────┘            └────────────┐
                ▼                                       ▼
        ┌──────────────┐                       ┌──────────────────┐
        │  @voila/db   │                       │ @voila/storage   │
        │  (Drizzle)   │                       │  (R2 / S3)       │
        └──────┬───────┘                       └────────┬─────────┘
               │                                        │
               ▼                                        ▼
        Cloudflare D1                              Cloudflare R2
        Postgres                                   Any S3-compatible
        SQLite
```

## Single mount point

The whole CMS is exposed through **one** TanStack Start route file:

```ts
// app/routes/admin/$.ts
import { createServerFileRoute } from '@tanstack/react-start/server'
import { content } from '~/content.config'

export const ServerRoute = createServerFileRoute('/admin/$').methods({
  GET:     ({ request }) => content.handle(request),
  POST:    ({ request }) => content.handle(request),
  PUT:     ({ request }) => content.handle(request),
  PATCH:   ({ request }) => content.handle(request),
  DELETE:  ({ request }) => content.handle(request),
})
```

`content.handle(request)` dispatches to one of three sub-handlers based on the path:

- `/admin/*` → serves the admin SPA (HTML shell + assets, then React Router takes over)
- `/api/*` → REST/RPC endpoints derived from the schema
- `/mcp/*` → JSON-RPC MCP server

The catch-all route is the **only** thing you add to your app. Everything else — admin pages, API endpoints, MCP tools — is generated from your `content.config.ts`.

## Data flow: a typical write

```
1. User edits a Post in the admin                                  (browser)
2. TanStack Form validates against the schema-derived validator    (browser)
3. TanStack DB optimistic mutation updates the local store         (browser)
4. POST /admin/api/posts/:id with the diff                         (browser → worker)
5. Handler authenticates, authorizes (RBAC), re-validates          (worker)
6. Drizzle UPDATE on D1; media URLs resolved against R2            (worker)
7. Webhooks + cache invalidation queued via Cloudflare Queues      (worker)
8. Response returns the canonical doc; TanStack DB reconciles      (browser)
9. Live preview channel (Durable Object) notifies subscribers      (worker → browser)
```

## Why not a standalone server?

We considered it. Three reasons we didn't:

1. **Deploy story**: one binary, one URL, one auth surface.
2. **Type sharing**: `import type { Post } from '~/content.config'` works in both the public site and the admin. No codegen.
3. **TanStack Start already gives us 80% of a CMS server** (routing, RPC, SSR, edge deploy). Building a second one is duplication.

## What's NOT in scope

- Visual page builder (use blocks + rich text)
- Marketing site builder (this is a CMS, not Webflow)
- Hosted SaaS tier (run it yourself; pay Cloudflare, not us)

---

Continue → [02 — Quick Start](./02-quick-start.md)
