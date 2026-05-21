# 12 — Roadmap

A milestone-based plan. Cut features before cutting quality.

## M0 — Foundations (week 1–2)

- [ ] Bun workspace scaffold
- [ ] `packages/schema` — field constructors + Zod derivation + `InferDoc<>`
- [ ] `packages/db` — Drizzle adapter for SQLite (local dev only)
- [ ] `packages/ui` — token CSS, Tailwind v4 setup, Phosphor icons, first 8 components (button, input, table, dialog, dropdown, toast, badge, card)
- [ ] `packages/content` — `defineContent` + `defineCollection` + handler skeleton (admin shell + healthcheck only)
- [ ] `playground/` TanStack Start app mounting the handler
- [ ] CI: lint + typecheck + unit tests

**Exit criterion**: `bun dev` boots a TanStack Start app, navigating to `/admin` shows the empty admin shell with the configured branding.

## M1 — Read path (week 3–4)

- [ ] Drizzle schema generation from field defs
- [ ] `voila migrate` (generate + apply via drizzle-kit)
- [ ] REST list/find/get endpoints
- [ ] Admin: collection list view (TanStack Table)
- [ ] Admin: singleton/detail view (read-only)
- [ ] Typed client (`@voila/client`)
- [ ] Auth: Better Auth wired in, email magic link (Resend default)
- [ ] First end-to-end: define `posts`, seed via SQL, list & read via admin + client

**Exit criterion**: 20-minute test #1 passes.

## M2 — Write path (week 5–6)

- [ ] Field widgets: string, number, boolean, date, datetime, select, slug
- [ ] TanStack Form integration with per-field Zod validators
- [ ] REST create/update/delete
- [ ] Optimistic updates via TanStack DB
- [ ] Collection hooks (before/after create/update/delete)
- [ ] Soft delete (trash) + restore UI
- [ ] Audit log

**Exit criterion**: Full CRUD on `posts` from the admin, with validation + optimistic UI.

## M3 — Rich content & media (week 7–8)

- [ ] `packages/storage` — R2 + S3 adapters
- [ ] Media field widget with presigned uploads
- [ ] Image variant generation (Cloudflare Images detection + Wasm fallback)
- [ ] Rich text field (Tiptap-based) with image/link/mention extensions
- [ ] Markdown + code fields
- [ ] Media library page

**Exit criterion**: Post with cover image + rich body renders correctly on the public site.

## M4 — Relations, i18n, drafts (week 9–10)

- [ ] One-to-many, many-to-many, polymorphic relations
- [ ] Relation widget (searchable combobox)
- [ ] `include` query param across REST + client
- [ ] Localized fields
- [ ] Drafts + versioning + scheduled publishing
- [ ] Version diff/restore UI

**Exit criterion**: 20-minute tests #2–#4 pass.

## M5 — Extensions & background work (week 11–12)

- [ ] Widget, page, action APIs
- [ ] Task definition + Queue adapter (Cloudflare Queues + in-process fallback)
- [ ] Cron triggers — config → `wrangler.jsonc` patching
- [ ] Webhooks with HMAC signing + retries
- [ ] Built-in tasks: `publish-scheduled`, `gc-versions`, `gc-trash`, `media-process`, `gc-media-orphans`

**Exit criterion**: 20-minute test #5 passes.

## M6 — MCP & RBAC (week 13–14)

- [ ] MCP server (HTTP + stdio)
- [ ] Tool generation from schema
- [ ] Resource exposure (`voila://`)
- [ ] OAuth 2.1 PKCE for MCP (via Better Auth)
- [ ] Field-level + doc-level access control
- [ ] API keys management UI

**Exit criterion**: Claude Code can connect, list collections, create/edit a post with full type safety.

## M7 — Polish & docs (week 15–16)

- [ ] Search (D1 FTS5 + Postgres FTS)
- [ ] Import/export (JSON, CSV)
- [ ] Live preview (Durable Object)
- [ ] Command palette (Cmd+K) — jump to any record/page/action
- [ ] Empty states, error boundaries, loading skeletons everywhere
- [ ] Documentation site (apps/docs) live
- [ ] One real-world reference site shipped on `content.voila.dev` infra

**Exit criterion**: 20-minute test #6 passes; public 0.1.0 release.

## Post-1.0 wishlist (no commitment)

- Visual diff for media variants
- Collaborative editing (Yjs over Durable Objects)
- Workflow / approvals (multi-stage publish)
- Multi-tenant first-class support
- Translation management (string-by-string with TM)
- Webflow-style block-based page builder (separate package)
- GraphQL adapter
- pglite local-dev backend
- Self-serve hosted offering (only if there's clear pull)

## Explicit non-goals

- A no-code schema editor
- A landing page builder
- A multi-CMS migrator (Strapi/Sanity/Contentful importers — community territory)
- Anything proprietary in the core

## Versioning

- 0.x: free to break.
- 1.0 ships when M7 closes and we've run two real sites on it for a month without incident.
- After 1.0: semver, deprecation cycles ≥ one minor release.

## How to help (when public)

- `apps/playground` is where most contributions land first.
- Field types are the easiest entry point.
- Don't open "support Strapi-like X" issues. Open "I need to do X for my site" issues.

---

End of plan. Start at [03 — DX](./03-dx.md) if you only read one doc.
