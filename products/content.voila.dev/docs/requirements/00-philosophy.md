# 00 — Philosophy

## A CMS that disappears into your app

A headless CMS is not infrastructure. 
It is a feature of your app. `content.voila.dev` is shipped as a library that you `import` and mount on a route.
It's not a server you deploy alongside your app.

If you can `defineRoute`, you can self-host a CMS.

## Principles

### 1. TanStack-native, end-to-end

Everything that can be a TanStack primitive, is.

- **Routing**: the admin is a TanStack Router subtree
- **Data**: TanStack Query for every read; TanStack DB for optimistic mutations
- **Forms**: TanStack Form for every field, validated with any [Standard Schema](https://standardschema.dev/) validator (Zod by default; Valibot, ArkType, Effect Schema, etc. all supported)
- **Tables**: TanStack Table for every list view
- **Server**: TanStack Start server functions, no separate Express/Hono
- **Deploy**: TanStack Start's Cloudflare adapter, no separate worker

No second ecosystem to learn. If you know TanStack, you know the internals.

### 2. Schema is the source of truth

You write **one** TypeScript schema. From it we derive:

- the admin UI (forms, tables, filters, detail views)
- the public REST/RPC API
- the typed client (`<typeof config>`)
- the runtime validators (any [Standard Schema](https://standardschema.dev/) library — Zod by default)
- the database migrations (Drizzle)
- the MCP tools and resources

DRY taken to its logical conclusion.

### 3. Edge-first, but portable

The reference target is Cloudflare (Workers + R2 + D1 + Queues + Cron). But every edge-coupled concern is hidden behind an adapter:

- `storage` adapter: R2, S3, any S3-compatible (MinIO, Backblaze B2)
- `database` adapter: D1, Postgres, SQLite via Drizzle
- `queue` adapter: Cloudflare Queues, BullMQ, in-memory
- `cron` adapter: Cloudflare Cron Triggers, node-cron, GitHub Actions

Cloudflare is the happy path, not a lock-in.

### 4. Headless, but with a great head

Most headless CMSes have ugly admins.

We don't. 

The admin is built with the same UI primitives a serious product team would reach for:
- shadcn/ui patterns over Base UI primitives
- Tailwind v4 design tokens
- Phosphor icons. 

### 5. Extensible without forking

Custom widgets, pages, sidebar panels, row buttons, bulk actions, background tasks, cron jobs and webhooks are all first-class.
You register them in your config, you don't patch the CMS.

### 6. Simple > clever

- No metaprogramming.
- No reflection.
- No code generation step at install time (types are inferred).
- No "framework inside a framework". If TanStack has it, we use it.

If the documentation needs a glossary, we got it wrong.

### 7. Full-featured, not minimal

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

### 8. Open source, MIT, no hosted tier

This is a library. There is no SaaS. Pay for Cloudflare, not for us.

---

Continue → [01 — Architecture](./01-architecture.md)
