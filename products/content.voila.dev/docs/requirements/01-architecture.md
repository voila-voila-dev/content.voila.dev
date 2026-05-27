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
│       │   │
│       │   │  ── Engine (Effect only, no React) ──────────────────────────────
│       │   │
│       │   ├── content-schema/         # @voila/content-schema — field constructors as annotated effect/Schemas; Locale type; deps: effect only
│       │   │   └── src/fields/         # string, number, boolean, date, json, relation, media… (one file each)
│       │   │
│       │   ├── content/                # @voila/content — the runtime brain
│       │   │   └── src/
│       │   │       ├── core/           #   resolver Services (Document/Mutation/Rbac/Hook) + default Layers, defineContent
│       │   │       ├── server/         #   subpath @voila/content/server — HttpApi, handlers, middleware, OpenAPI (L4)
│       │   │       ├── client/         #   subpath @voila/content/client — typed client from HttpApi (L5)
│       │   │       ├── queue/          #   task API (defineTask) + inline/Cloudflare Layers; /queue/* optional adapters
│       │   │       └── i18n/           #   localized-field support (storage-shape flip)
│       │   │
│       │   ├── content-sql/            # @voila/content-sql — Database Service over @effect/sql; migration generator
│       │   │   └── src/dialects/       #   subpaths /d1 /pg /sqlite — each a SqlClient Layer; drivers are optional peers
│       │   │
│       │   ├── content-storage/        # @voila/content-storage — Storage Service + /r2 /s3 Layers, presign, transforms
│       │   ├── content-auth/           # @voila/content-auth — Auth Service; Better Auth bridged as a Layer (swappable)
│       │   ├── content-mcp/            # @voila/content-mcp — MCP server over HttpApi/schema; HTTP + stdio transports
│       │   │
│       │   │  ── Tooling ─────────────────────────────────────────────────────
│       │   │
│       │   ├── content-cli/            # @voila/content-cli — `voila` on @effect/cli: migrate, seed, add/diff/list, i18n sync, doctor, mcp
│       │   └── content-registry/       # @voila/content-registry — registry.json manifest + vended source for L6–L11
│       │
│       ├── examples/                   # example consumers used in docs
│       └── docs/                       # product-specific design docs (this directory)
│
├── packages/                           # cross-product shared packages (no product prefix)
│   ├── typescript-config/              # @voila/typescript-config — shared tsconfig bases
│   ├── ui/                             # @voila/ui — shadcn-on-Base-UI primitives, Tailwind v4 tokens, Phosphor icons
│   └── rich-text-editor/               # @voila/rich-text-editor — Plate/Slate editor behavior + serialization + default node components (/nodes)
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

## The two worlds

`content.voila.dev` is split into **two worlds** with a hard contract between them:

| World | What it is | How you get it | Tech |
| --- | --- | --- | --- |
| **The Engine** | Headless CMS brain — schema, resolvers, SQL, HTTP API, auth, storage, tasks | `npm install` (versioned, semver) | **Effect only.** No React. |
| **The Head** | Admin UI + its mount points | `voila add` (registry CLI, shadcn-style) | **TanStack + React.** You own it. |

You **depend on** the Engine and **own** the Head. The contract between them is the typed HTTP client (`@voila/content/client`) and the schema types (`@voila/content-schema`). Effect never leaks into the Head; React never leaks into the Engine.

## Runtime architecture

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                    Your TanStack Start app                        │
  │                                                                   │
  │   content.config.ts                                               │
  │   └─ export default defineContent({                               │
  │         collections: [posts],                                     │
  │         database: D1Live({ binding: "DATABASE" }),  // a Layer    │
  │         storage:  R2Live({ bucket: "media" }),       // a Layer   │
  │      })                                                           │
  │            │                                                      │
  │            ▼  voila add (registry CLI, run once)                  │
  │   ┌─────────────────────────────────────────────────────────┐     │
  │   │  Vended route files (real files — you own these)        │     │
  │   │                                                         │     │
  │   │   app/server/voila.ts          ← thin mount file        │     │
  │   │   app/routes/admin/$.tsx       ← admin splat route      │     │
  │   │   app/routes/admin/_layout.tsx ← admin shell            │     │
  │   │   app/routes/admin/posts/…     ← collection pages       │     │
  │   │   components/admin/…           ← tables, forms, widgets │     │
  │   └─────────────────────────────────────────────────────────┘     │
  │            │                                                      │
  │            ▼                                                      │
  │   ┌─────────────────────────────────────────────────────────┐     │
  │   │  TanStack Router + Start                                │     │
  │   │  (routing, SSR, server routes)                          │     │
  │   └─────────────────────────────────────────────────────────┘     │
  └─────────────────────┬────────────────────────────────────────────┘
                        │  HTTP (typed client / HttpApi)
                        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │               The Engine (npm dependencies)                       │
  │                                                                   │
  │   @voila/content/server  ─── HttpApi definition                    │
  │   │  HttpApiGroup per collection                                  │
  │   │  HttpApiEndpoint per operation                                │
  │   │  Derives: server handlers · typed client · OpenAPI           │
  │   │                                                               │
  │   @voila/content  ─── DocumentService · MutationService     │
  │                             RbacService · HookService             │
  │                             (Effect Services + default Layers)    │
  │                                                                   │
  │   @voila/content-auth          ─── Auth Service (Better Auth Layer)      │
  │   @voila/content         ─── Task Service (Queues / inline Layer)  │
  └──────────┬────────────────────────────────────────┬──────────────┘
             │                                        │
             ▼                                        ▼
  ┌───────────────────────┐              ┌────────────────────────┐
  │  @voila/content-sql           │              │  @voila/content-storage        │
  │  @voila/content-sql/d1        │              │  (R2 / S3 Layer)       │
  │  @voila/content-sql/pg        │              └──────────┬─────────────┘
  │  @voila/content-sql/sqlite    │                         │
  └──────────┬────────────┘                         ▼
             │                              Cloudflare R2
             ▼                              Any S3-compatible
    Cloudflare D1
    Postgres
    SQLite
```

## Single integration point

The single integration point is **`voila add`** — the registry CLI command that vends real files into your repo — paired with a **`content.config.ts`** that wires the Engine's `Layer` graph.

Run `voila add admin-shell` once (or after creating a new collection) and the CLI:
1. Copies TanStack route files into your `app/routes/admin/`
2. Copies React components (tables, forms, widgets) into your `components/admin/`
3. Copies a thin server mount file at `app/server/voila.ts`
4. Installs any npm dependencies the items declare

No virtual routes. No Vite plugin generating invisible files. Every file the CLI copies is a real file you can read, grep, git-blame, and edit.

```ts
// content.config.ts — the Engine's configuration
import { defineContent } from "@voila/content"
import { D1Live } from "@voila/content-sql/d1"
import { R2Live } from "@voila/content-storage"

import { posts, authors } from "./app/content/collections"
import { siteSettings } from "./app/content/singletons"

export default defineContent({
  branding: { name: "Acme CMS", accent: "#FF6A00" },
  collections: [posts, authors],
  singletons: [siteSettings],
  database: D1Live({ binding: "DATABASE" }),   // a Layer
  storage:  R2Live({ bucket: "media" }),        // a Layer
})
// internally → Layer.mergeAll(SchemaLive, CoreLive, HttpLive, database, storage, …)
//            → ManagedRuntime.make(…) consumed by the vended mount file
```

```ts
// app/server/voila.ts — VENDED by `voila add`, ~3 lines you own
import { makeHandler } from "@voila/content/server"
import config from "~/content.config"

export const voilaHandler = makeHandler(config)  // add your middleware here
```

The mount file is intentionally thin: you own the mount point (path, middleware, rate limiting) while the handler logic stays in the Engine dependency. That single seam is what makes this "you own your code" and "you never touch Effect internals" at the same time.

**Power-user extension** — swap or wrap any `Service` by providing a different `Layer`:

```ts
defineContent({
  // …
  database: TursoLive({ url }),                         // swap the dialect Layer
  layers: [Layer.effect(MutationService, auditedMutations)],  // wrap a resolver
})
```

**`voila diff`** shows drift between your vended copy and upstream; **`voila list`** shows the full registry catalog. The opt-in **`--eject-server`** flag additionally vends the `HttpApi` definition + handlers for teams that want to own them — not the default.

The same `content.config.ts` is consumed by the CLI (`voila migrate`, `voila seed`), the standalone MCP stdio binary, and your own site code (e.g., `import content from "~/content.config"` in a public route loader).

## Data flow: a typical write

```
1. User edits a Post in the admin                                         (browser)
2. TanStack Form validates via Schema.standardSchemaV1                    (browser)
3. TanStack DB optimistic mutation updates the local store                 (browser)
4. @voila/content/client POST /admin/api/posts/:id carries the diff       (browser → worker)
5. HttpApiMiddleware: CSRF check, session enforcement                      (worker)
6. HttpApi handler calls MutationService; Schema.decodeUnknown re-validates(worker)
7. @voila/content-sql UPDATE on D1 (or Postgres); media URLs resolved via @voila/content-storage (worker)
8. HookService fires after-update hooks; Webhooks queued via @voila/content  (worker)
9. Response returns the canonical doc (envelope: { data }); TanStack DB reconciles (browser)
10. Live preview channel (Durable Object) notifies subscribers             (worker → browser)
```

The typed client (`@voila/content/client`) is derived from the `HttpApi` definition in `@voila/content/server` — the same definition that produced the server handlers and the OpenAPI spec. Type safety from schema annotation to client call, with no manual sync.

Mutations from the admin default to the `HttpApi` client everywhere. REST endpoints under `/admin/api/` are the same operations exposed for non-TS consumers. Both share identical validation, hooks, and RBAC — they're thin transport wrappers around the same `Service` `Layer`s.

## Why not a standalone server?

We considered it. Three reasons we didn't:

1. **Deploy story**: one binary, one URL, one auth surface.
2. **Type sharing**: `import content from '~/content.config'` works in the public site, the admin, and the CLI. No codegen.
3. **TanStack Start already gives us 80% of a CMS server** (routing, SSR, edge deploy). We commit to it as the integration substrate — see [ADR 0002](../../../../docs/decision-records/0002-tanstack-start-integration.md).

## What's NOT in scope

- Visual page builder (use blocks + rich text)
- Marketing site builder (this is a CMS, not Webflow)
- Hosted SaaS tier (run it yourself; pay Cloudflare, not us)

---

Continue → [02 — Quick Start](./02-quick-start.md)
