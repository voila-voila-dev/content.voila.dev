# 00 — Philosophy

## A CMS that disappears into your app

A headless CMS is not infrastructure. 
It is a feature of your app. `content.voila.dev` is shipped as a set of **Effect** packages you depend on, plus real route files the registry vends into your repo.
It's not a server you deploy alongside your app.

If you can `defineRoute`, you can self-host a CMS.

## Principles

### 1. TanStack-native, end-to-end (the Head)

Everything in the admin UI that can be a TanStack primitive, is.

- **Routing**: the admin is a TanStack Router subtree — real files in your `app/`, not virtual routes
- **Data**: TanStack Query for every read; TanStack DB for optimistic mutations
- **Forms**: TanStack Form for every field, validated against the schema's Standard Schema export (`Schema.standardSchemaV1`)
- **Tables**: TanStack Table for every list view
- **Server**: TanStack Start server routes, no separate Express/Hono
- **Deploy**: TanStack Start's Cloudflare adapter, no separate worker

No second ecosystem to learn. If you know TanStack, you know the Head — and you own every file in it.

### 2. Effect-native engine (the Engine)

The headless brain of the CMS is built entirely on the **Effect** platform. You depend on it as a versioned npm package and never have to open its source.

- **Schema**: `effect/Schema` — field constructors, decode/encode, type inference, all in one annotated object
- **Services**: every capability (documents, mutations, RBAC, auth, storage, tasks) is an `Effect` `Service` with a default `Layer`
- **API**: `@effect/platform` `HttpApi` defines the REST surface; server handlers, the typed client, and OpenAPI all derive from the same definition
- **Database**: `@effect/sql` — swap a database by providing a different dialect `Layer` (`D1Live`, `PgLive`, `SqliteLive`)
- **Extensibility**: provide a different `Layer` for any `Service`; compose additional `HttpApiGroup`s on top — never fork, never eject

Effect is deliberately encapsulated. The goal is the same as TanStack for the Head: **if you know Effect, you can extend the engine; if you don't, you never need to**.

### 3. Schema is the source of truth

You write **one** TypeScript schema using `effect/Schema` field constructors. From it we derive:

- the admin UI (forms, tables, filters, detail views)
- the public REST API (via `@effect/platform` `HttpApi`)
- the typed client (`@voila/content/client`, derived from the same `HttpApi`)
- the runtime validators (`Schema.decodeUnknown` / `Schema.encode`, server and client)
- the database migrations (`@effect/sql` Migrator, reads field annotations)
- the MCP tools and resources

`effect/Schema` is itself Standard-Schema-compliant via `Schema.standardSchemaV1`, so the vended Head forms speak a standard contract — no translation layer. There is no Zod adapter, no pluggable validator system. One schema language, end to end.

DRY taken to its logical conclusion.

### 4. Edge-first, but portable

The reference target is Cloudflare (Workers + R2 + D1 + Queues + Cron). But every edge-coupled concern is hidden behind a `Layer`:

- `database` Layer: `@voila/content-sql/d1`, `@voila/content-sql/pg`, `@voila/content-sql/sqlite`
- `storage` Layer: R2, S3, any S3-compatible (MinIO, Backblaze B2) via `@voila/content-storage`
- `queue` Layer: Cloudflare Queues, inline/in-memory via `@voila/content`
- `cron` Layer: Cloudflare Cron Triggers, node-cron, GitHub Actions

Cloudflare is the happy path, not a lock-in. Swapping a backend means providing a different `Layer`, not forking anything.

### 5. Headless, but with a great head

Most headless CMSes have ugly admins.

We don't. 

The admin is vended into your repo as real source files — TanStack routes and React components you fully own — built with the same UI primitives a serious product team would reach for:
- shadcn/ui patterns over Base UI primitives
- Tailwind v4 design tokens
- Phosphor icons

Restyle it, re-path it, extend it with your own pages. It's your code.

### 6. Extensible without forking

Custom widgets, pages, sidebar panels, row buttons, bulk actions, background tasks, cron jobs, and webhooks are all first-class.
You register them in your config or add a `Layer` — you don't patch the CMS.

The two extension surfaces:
- **Head extensions** (widgets, pages, UI): register in `content.config.ts` or run `voila add` to pull a registry item
- **Engine extensions** (swap DB, intercept mutations, add endpoints): provide a different `Layer` for any `Service`

### 7. Simple > clever

- No virtual routes, no Vite plugin magic generating invisible files.
- No reflection or runtime metaprogramming.
- No code generation step at install time (types are inferred from `effect/Schema`).
- Effect's `Layer` model is the one "concept beyond TanStack" you may encounter — only if you choose to extend the engine.

The admin routes are greppable, debuggable, and PR-diffable because they are real files.
The engine is a versioned dependency you `npm update`.

If the documentation needs a glossary, we got it wrong.

### 8. Full-featured, not minimal

Simple at the surface, complete underneath. Day-one feature set:

- Localization (i18n)
- Drafts, versions, scheduled publishing
- Role-based access control (per-collection, per-field)
- Image/video transforms via R2 + Cloudflare Images
- Webhooks
- Search (D1 FTS5 / Postgres FTS)
- Audit log
- Import/export (JSON, CSV)
- Live preview
- MCP server for AI agents

### 9. Open source, MIT, no hosted tier

This is a library. There is no SaaS. Pay for Cloudflare, not for us.

---

Continue → [01 — Architecture](./01-architecture.md)
