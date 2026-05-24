# 12 — Roadmap

A milestone-based plan. Cut features before cutting quality.

Each milestone ships with a **testing bar** that must pass before the milestone is marked done. All tests run on `bun test` (no Vitest, no Jest). E2E uses Playwright driven from `bun test`.

> **20-minute tests** referenced as exit criteria are the scripted smoke walkthroughs defined at the bottom of [03 — DX](./03-dx.md). Each one is a 20-minute "fresh clone → working site" pass executed by a human.

Capacity assumption: **1 FTE**. Week ranges below are nominal; slip the date, never the exit criterion.

---

## M0 — Foundations & Cloudflare playground (week 1–2)

Goal: a `bun dev` that boots a real TanStack Start app on the Cloudflare runtime (via `wrangler dev`), with the empty admin shell rendering through the catch-all route. Everything below this milestone assumes the playground is the canary.

### Repo & tooling

- [X] Bun workspace scaffold (`bun init -y`, `workspaces` field in root `package.json`)
- [X] Product-partitioned layout: `products/content.voila.dev/{apps,packages,examples,docs}/` plus root-level `packages/` for cross-product code (see [ADR 0001](../../../../docs/decision-records/0001-monorepo-and-package-naming.md))
- [X] Root `tsconfig.json` with project references; per-package `tsconfig.build.json`
- [X] Biome (lint + format) wired with a single root config
- [X] `bun run check` aggregate script: `biome check && tsc -b && bun test`
- [X] `.gitignore`, `.bun-version` (formatting handled by Biome — no `.editorconfig` needed)
- [X] Conventional Commits + `lefthook` pre-commit (lint-staged + typecheck on changed packages)
- [X] **Changesets** (`@changesets/cli` + `@changesets/changelog-github`) for per-package versioning & changelogs in the Bun workspace — `bun changeset` to author entries, `bun changeset version` to bump + write `CHANGELOG.md` per package, `bun changeset publish` to release. Configured with `fixed: [["@voila/*"]]` so every package in the scope always ships on the same version (lock-step releases); `access: public`, `baseBranch: main`. See [ADR 0001](../../../../docs/decision-records/0001-monorepo-and-package-naming.md) for the monorepo and naming conventions.
- [X] `.changeset/config.json` committed; GitHub Action (`changesets/action@v1`) opens the "Version Packages" PR on every push to `main` and publishes on merge

### `packages/schema`

- [X] Field constructors: `string`, `number`, `boolean`, `date`, `datetime`, `json` (stubs only — full widgets land M2)
- [X] Standard Schema derivation from field defs (`toValidator(field)`); ships a Zod adapter by default with hooks for Valibot, ArkType, etc. (see [Standard Schema](https://standardschema.dev/))
- [X] `InferDoc<>` type helper
- [X] `defineField` extension API (for third-party field packages)

### `packages/database`

- [X] Drizzle adapter interface (`DatabaseAdapter` type)
- [X] SQLite adapter for local dev (`@voila/content-database/sqlite`)
- [X] **D1 adapter (Cloudflare)** — wraps `drizzle-orm/d1`; used by the playground
- [X] Postgres adapter scaffold (interface only; impl in M2)

### `packages/ui`

- [X] CSS token layer (`@voila/ui/styles.css`) — colors, spacing, radii, typography
- [X] Tailwind v4 preset (`@voila/ui/tailwind`)
- [X] Phosphor icon re-exports (`@voila/ui/icons`)
- [X] All primitives from shadcnui

### `apps/ui.voila.dev`

- [X] Storybook demo app showcasing all `@voila/ui` components
- [X] Stories for each primitive
- [X] Token layer + Tailwind preset wired so stories render with real theme
- [X] Icon gallery story for `@voila/ui/icons`

### `packages/content`

Integration model lands per [ADR 0002](../../../../docs/decision-records/0002-tanstack-start-integration.md) — vite plugin + auto-discovered `content.config.ts`.

- [X] `defineContent`, `defineCollection`, `defineSingleton` signatures
- [X] `@voila/content/vite` subpath — `voila()` plugin stub that auto-discovers `./content.config.ts` and registers M0 virtual routes
- [X] Admin shell route component (`/admin` → blank layout with branding) — mounted via virtual route
- [X] Healthcheck server file route (`/admin/api/health`) — virtual route
- [X] First-run gate (`/admin/setup` placeholder) — virtual route

### `products/content.voila.dev/apps/playground.content.voila.dev/` (the canary app)

- [X] `bunx --bun @tanstack/cli@latest create playground.content.voila.dev --framework React --deployment cloudflare --target-dir products/content.voila.dev/apps/playground.content.voila.dev` (the historical `create-tsr` CLI was renamed to `@tanstack/cli create`)
- [X] Wire `@voila/content` via `voila()` in `vite.config.ts` (auto-discovers `content.config.ts`)
- [X] `content.config.ts` with empty collections array
- [X] `wrangler.jsonc` committed with D1 + R2 + Queues bindings (D1 active, R2/Queues commented for M3/M5)
- [X] `.dev.vars.example` with `VOILA_AUTH_SECRET`
- [X] Local D1 via `bun run db:init` (`wrangler d1 execute DATABASE --local --file=migrations/0000_init.sql`)
- [X] `bun dev` script runs `vite dev --port 8787` — Miniflare runs in-process via `@cloudflare/vite-plugin` (no separate `wrangler dev` step needed)
- [X] README documenting first-run: `bun install && bun dev → http://localhost:8787/admin`

### Testing bar (M0)

- [X] `bun test` runner configured at the root; per-package `*.test.ts` colocated with source
- [X] **Unit**: `packages/schema` field constructors + validator derivation (Zod adapter + Standard Schema contract) — ≥ 90% line coverage on that package
- [X] **Unit**: `packages/ui` primitives smoke-render via `@testing-library/react` + `happy-dom`
- [X] **Integration**: plugin's generated admin route files (`src/routes/admin/$.tsx` + `api/health.ts`) hit via an in-memory `Request` against the playground build, asserting admin shell HTML + healthcheck JSON
- [X] **CI**: GitHub Actions matrix on `ubuntu-latest`, Bun stable; runs `bun run check`
- [X] Coverage report via `bun test --coverage`; baseline committed (no gate yet)

**Exit criterion**: `bun dev` in `products/content.voila.dev/apps/playground.content.voila.dev/` boots vite with Miniflare in-process (via `@cloudflare/vite-plugin`); `http://localhost:8787/admin` renders the empty admin shell with branding from `content.config.ts`. `bun run check` is green on CI.

---

## M1 — Read path (week 3–4)

Depends on M0. SQLite + D1 adapters must be green before this starts.

### Schema → Database

- [X] Drizzle table generator from field defs (`schemaToTables(collections)`)
- [X] System columns: `id` (ulid), `createdAt`, `updatedAt`, `deletedAt` (nullable, for M2 soft delete)
- [X] `voila migrate generate` — emits initial DDL via `emitInitialMigration` (drizzle-kit diff wrapper lands in M2)
- [X] `voila migrate apply` — local SQLite + `--target d1-local|d1-remote` (wraps `wrangler d1 migrations apply`)
- [X] Migration file naming + idempotency guard (`migrations/.voila-journal.json` schema-hash)

### REST read endpoints

- [X] `GET /admin/api/:collection` (list, with `?limit`, `?cursor`, `?orderBy`)
- [X] `GET /admin/api/:collection/:id` (find by id)
- [X] `GET /admin/api/:collection/by/:field/:value` (find by unique field)
- [X] Cursor pagination (no offset)
- [X] Error envelope spec (`{ error: { code, message, details? } }`)

### Admin (read-only)

- [X] Collection list view with TanStack Table — sortable columns from `list.columns`
- [X] Detail view (read-only field renderers)
- [X] Singleton view
- [X] Sidebar nav generated from collection registry
- [X] Loading skeletons + empty states for both views

### Typed client

- [X] `@voila/content-client` package — typed wrapper over `fetch`
- [X] `createClient<typeof content>()` factory returning `client.posts.find/findOne/list`
- [X] Type tests under `packages/client/test-d/` (asserts inferred shapes)

### Auth (read-side only)

- [X] Better Auth wired into the handler — `@voila/content-auth/server` `createAuth()`; generated splat route `/admin/api/auth/$.ts` delegates to `auth.handler(request)`
- [X] Email magic link adapter (Resend default; SMTP fallback) — `@voila/content-auth/mailers` with `resolveMailer({ env })`: Resend → SMTP → console fallback
- [X] Session middleware for `/admin/*` — `requireSession()` invoked from the admin layout's `beforeLoad` via `createIsomorphicFn`; unauth → `/admin/login?next=…`
- [X] `voila seed admin` CLI command — `--target sqlite|d1-local|d1-remote`, mirrors `migrate apply`; verified upserts on re-runs

### Testing bar (M1)

- [ ] **Unit**: schema-to-Drizzle generator — golden-file tests for each field type
- [ ] **Integration**: REST read endpoints against a real SQLite file (created + torn down per test)
- [ ] **Integration**: REST read endpoints against `wrangler dev` D1 (workers-pool runner via `@cloudflare/vitest-pool-workers` adapted for `bun test`, or fall back to `wrangler dev --local` + fetch)
- [ ] **Type**: client inference tests (`tsd`-style assertions)
- [ ] **E2E (Playwright)**: log in via magic link (Resend test mode), browse `posts` list, open detail. Runs against the playground.
- [ ] Coverage gate enabled: `packages/schema` ≥ 90%, `packages/content` ≥ 70%

**Exit criterion**: 20-minute test #1 passes. `bun test` runs unit + integration + E2E in CI under 8 minutes.

---

## M2 — Write path (week 5–6)

Depends on M1 (REST + auth + admin shell).

### Field widgets

- [ ] `string` widget (single/multiline)
- [ ] `number` widget (with min/max/step)
- [ ] `boolean` widget (switch)
- [ ] `date` + `datetime` widgets
- [ ] `select` widget (static options)
- [ ] `slug` widget (auto-derived from a sibling field; manual override)
- [ ] Widget registry + `defineWidget` API

### Form layer

- [ ] TanStack Form integration; per-field Standard Schema validators from `toValidator` (Zod adapter by default)
- [ ] Server-side validation reuses the same validator (single source of truth, library-agnostic via Standard Schema)
- [ ] Field-level error rendering
- [ ] Form-level submit errors + retry

### REST write endpoints

- [ ] `POST /admin/api/:collection` (create)
- [ ] `PATCH /admin/api/:collection/:id` (partial update)
- [ ] `DELETE /admin/api/:collection/:id` (soft delete by default)
- [ ] `POST /admin/api/:collection/:id/restore`
- [ ] CSRF protection (double-submit cookie)

### State

- [ ] TanStack DB integration for optimistic updates
- [ ] Conflict resolution: last-write-wins with `updatedAt` precondition
- [ ] Toast notifications for success/failure

### Postgres adapter (lands here, not M7)

- [ ] `@voila/content-database/postgres` using `drizzle-orm/postgres-js`
- [ ] Migration parity with SQLite/D1 adapter
- [ ] `voila migrate apply --postgres` path

### Lifecycle

- [ ] Collection hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`
- [ ] Audit log (writes to `_voila_audit` table)
- [ ] Trash page (deleted docs, restore + purge)

### Testing bar (M2)

- [ ] **Unit**: each widget renders, accepts input, surfaces validator errors (matrix: Zod + at least one other Standard Schema library)
- [ ] **Unit**: hook ordering + short-circuit semantics
- [ ] **Integration**: CRUD against SQLite **and** Postgres (matrix in CI)
- [ ] **Integration**: optimistic update rollback on server error
- [ ] **E2E**: create a post, edit it, delete it, restore it, purge it
- [ ] **Property test** (`fast-check` via `bun test`): roundtrip arbitrary valid docs through create → find → update → find
- [ ] Coverage gate raised: `packages/content` ≥ 80%

**Exit criterion**: Full CRUD on `posts` from the admin with validation + optimistic UI. Postgres CI matrix green.

---

## M3 — Rich content & media (week 7–8)

Depends on M2 (write path) and Cloudflare R2 binding (enabled in playground here).

### Storage

- [ ] `packages/storage` — `StorageAdapter` interface
- [ ] R2 adapter (`@voila/storage/r2`)
- [ ] S3 adapter (`@voila/storage/s3`) — works against MinIO in CI
- [ ] Presigned upload URL generation
- [ ] Public URL strategy (`storage.publicUrl` config)

### Media field

- [ ] `media` field widget with drag-and-drop
- [ ] Multipart upload for files > 5 MB
- [ ] Client-side validation (mime, max size) before presign
- [ ] Upload progress + cancel
- [ ] Media library page (grid view, search by filename, filter by mime)

### Image variants

- [ ] Variant config DSL (`fields.media({ variants: { thumb: { w: 200 } } })`)
- [ ] Cloudflare Images detection (use binding if present)
- [ ] Wasm fallback (`@jsquash/jpeg` + `@jsquash/webp`)
- [ ] Lazy variant generation (on first request, cached in R2)
- [ ] Orphan tracking (delete media → mark unreferenced)

### Rich text

The editor ships as two standalone packages — `@voila/rich-text-editor` (behavior) and `@voila/rich-text-nodes` (presentation) — composed by the `richText` field. Their full feature roadmap lives in [`packages/rich-text-editor/docs.md`](../../../../packages/rich-text-editor/docs.md); the items below are only what M3 needs.

- [ ] `richText` field wires `@voila/rich-text-editor` + `@voila/rich-text-nodes`
- [ ] Default plugins: bold, italic, headings, lists, links, code, blockquote
- [ ] `plugins` / `components` field options pass through for extension (see [03 — DX §f](./03-dx.md))
- [ ] Inline image (uses media field machinery)
- [ ] Mention plugin (for cross-references; resolves at render via `include`)
- [ ] Markdown serialization roundtrip (`toMarkdown`, `fromMarkdown`)
- [ ] Static (SSR) render path for read-only output on the public site
- [ ] `markdown` field (raw, no Plate UI)
- [ ] `code` field with syntax highlight (Shiki, server-side render)

### Testing bar (M3)

- [ ] **Unit**: Plate plugins render expected HTML/markdown
- [ ] **Unit**: image variant pipeline (golden image diff with tolerance)
- [ ] **Integration**: full upload → variant → fetch via R2 (local Miniflare R2)
- [ ] **Integration**: same against S3/MinIO
- [ ] **E2E**: drag image into rich text, publish, render on public site
- [ ] **Performance**: variant generation < 2s p95 for 2 MB JPEG (asserted in `bun test --bail`)

**Exit criterion**: Post with cover image + rich body renders correctly on the public playground site. Image variants generate on demand and cache in R2.

**Risks called out**: Cloudflare Images binding only available on paid plan — Wasm fallback must be production-quality, not a stub.

---

## M4 — Relations, i18n, drafts (week 9–10)

Depends on M2 (write path).

### Relations

- [ ] `relation` field (one-to-many, many-to-one)
- [ ] `relations` field (many-to-many via join table)
- [ ] Polymorphic relations (`{ to: ['posts', 'pages'] }`)
- [ ] Searchable combobox widget with debounced server search
- [ ] `include` query param across REST + client (`client.posts.findOne({ id, include: { author: true } })`)
- [ ] Cascade rules: `onDelete: 'cascade' | 'restrict' | 'set null'`

### i18n

- [ ] `localized: true` per field
- [ ] Locale tabs in the editor
- [ ] Per-locale validation (required-in-default-locale; optional in others by default)
- [ ] Paraglide integration (see [13 — i18n](./13-i18n-paraglide.md))
- [ ] Locale-aware list filtering

### Drafts & versioning

- [ ] `draft` + `publishedAt` columns
- [ ] Version table (`_voila_versions`)
- [ ] Save = new version; publish = bump `publishedAt`
- [ ] Version list UI per doc
- [ ] Diff view (side-by-side text diff per field)
- [ ] Restore-from-version action
- [ ] Scheduled publish (writes a task — depends on M5 for actual execution; until M5, fall back to a cron-checking handler in the worker)

### Testing bar (M4)

- [ ] **Unit**: relation resolver handles cycles + N+1 detection
- [ ] **Integration**: `include` returns correctly shaped types (cross-checked with `tsd`)
- [ ] **Integration**: localized field stores per-locale, falls back to default when missing
- [ ] **Integration**: version diff/restore against SQLite + Postgres
- [ ] **E2E**: save draft, schedule publish for +1 min, observe publication
- [ ] **E2E (i18n)**: define a post in EN, translate to FR, observe locale switching on public site

**Exit criterion**: 20-minute tests #2 (relations), #3 (i18n), #4 (drafts/versions) pass.

---

## M5 — Extensions & background work (week 11–12)

Depends on M4 (drafts/scheduled publishing wants the task system).

### Extension APIs

- [ ] `defineWidget` (M2 already shipped the runtime; this milestone freezes the public type)
- [ ] `definePage` (custom admin pages)
- [ ] `defineAction` (bulk actions on collection rows)
- [ ] Plugin loader (`plugins: [auditPro(), …]` in `content.config.ts`)
- [ ] Plugin lifecycle (`onRegister`, `onMigrate`, `onStart`)

### Background tasks

- [ ] `defineTask({ name, run })` API
- [ ] `@voila/queue` adapter interface
- [ ] Cloudflare Queues adapter (producer + consumer)
- [ ] In-process adapter (`queue: 'inline'`) for self-hosted Node/Bun
- [ ] Retry policy DSL (`retry: { max: 5, backoff: 'exponential' }`)
- [ ] Dead-letter queue surfaced on a Tasks admin page
- [ ] Task observability: last run, last error, runtime histogram

### Cron

- [ ] Cron trigger DSL (`defineCron({ schedule, task })`)
- [ ] `voila migrate` patches `wrangler.jsonc` `triggers.crons`
- [ ] `scheduled()` worker entrypoint dispatcher
- [ ] Conflict detection (two crons writing the same schedule)

### Webhooks

- [ ] `defineWebhook({ on, url, secret })`
- [ ] HMAC-SHA256 signing header (`X-Voila-Signature`)
- [ ] Retry policy reusing task infra
- [ ] Webhook delivery log in admin

### Built-in tasks

- [ ] `publish-scheduled` (every minute)
- [ ] `gc-versions` (daily, respects `versionDays`)
- [ ] `gc-trash` (daily, respects `trashDays`)
- [ ] `media-process` (variant generation, triggered on upload)
- [ ] `gc-media-orphans` (weekly)

### Testing bar (M5)

- [ ] **Unit**: queue adapter contract tests (same suite runs against inline + Cloudflare Queues local)
- [ ] **Integration**: scheduled publish end-to-end with mocked clock
- [ ] **Integration**: webhook HMAC verification roundtrip
- [ ] **Integration**: dead-letter routing on persistent failure
- [ ] **E2E**: schedule a publish 30s out, observe execution + audit log entry
- [ ] **Chaos**: kill the worker mid-task; restart; assert task is retried not duplicated (idempotency key check)

**Exit criterion**: 20-minute test #5 passes. All built-in tasks run on a 24h soak in the playground without errors.

---

## M6 — MCP & RBAC (week 13–14)

Depends on M1 (auth) + M5 (defineAction).

### MCP server

- [ ] HTTP transport at `/admin/api/mcp`
- [ ] stdio transport via `bunx voila mcp`
- [ ] Tool generation from collection schema (one tool per CRUD op per collection)
- [ ] Resource exposure (`voila://posts/<id>`)
- [ ] Streaming responses for long-running actions

### Auth for MCP

- [ ] Bearer token mode (API keys)
- [ ] OAuth 2.1 PKCE flow via Better Auth
- [ ] Scope DSL (`mcp.scopes: { 'posts:read': […] }`)
- [ ] Token revocation UI

### RBAC

- [ ] Role model (`admin`, `editor`, `viewer` default; custom roles)
- [ ] Doc-level access (`access: { read, create, update, delete }` per collection)
- [ ] Field-level access (`read`, `write` predicates per field)
- [ ] Filtered queries (access predicate folded into the SQL `WHERE`)
- [ ] API keys management UI (create, scope, revoke)

### Testing bar (M6)

- [ ] **Unit**: scope-to-predicate compiler
- [ ] **Integration**: full MCP handshake + tool invocation over HTTP + stdio
- [ ] **Integration**: OAuth PKCE happy path + every documented error case (RFC 6749 §5.2)
- [ ] **Integration**: doc-level access denies/allows across roles
- [ ] **Integration**: field-level redaction (read denied → field absent from response, not nulled)
- [ ] **Security**: token leakage tests (no token in logs, no token in error envelopes)
- [ ] **E2E**: Claude Code connects via MCP, lists `posts`, creates one, edits it

**Exit criterion**: Claude Code can connect, list collections, create/edit a post with full type safety. RBAC denies are observable in the audit log.

---

## M7 — Polish & docs (week 15–16)

Depends on everything.

### Search

- [ ] D1 FTS5 virtual table generation per collection
- [ ] Postgres FTS (`tsvector` + GIN index) parity
- [ ] `client.posts.search('query')` API
- [ ] Search box in admin (Cmd+K integration)

### Import/export

- [ ] `voila export <collection> --format json|csv`
- [ ] `voila import <collection> <file>` with dry-run
- [ ] Schema-aware diff on import

### Live preview

- [ ] `VoilaRoom` Durable Object
- [ ] Preview token signing
- [ ] WebSocket draft sync
- [ ] Public preview URL (`/preview?token=…`)

### Command palette

- [ ] `Cmd+K` opens palette
- [ ] Jump to any collection / record / page / action
- [ ] Fuzzy search (uses the FTS index when available)

### Polish

- [ ] Empty state for every list/detail/widget
- [ ] Error boundaries on every admin route + telemetry hook
- [ ] Loading skeletons matching final layout (no CLS)
- [ ] Accessibility pass (axe-core, keyboard nav, focus rings, ARIA)
- [ ] Performance budget: TTI < 2s on mid-tier laptop for admin list view with 1k rows
- [ ] Bundle size budget per package (CI gate via `size-limit`)

### Docs

- [ ] `products/content.voila.dev/apps/docs` site live at `content.voila.dev`
- [ ] All 13 docs ported from `docs/` to the docs app
- [ ] API reference auto-generated from TypeScript (`api-extractor`)
- [ ] At least 1 real-world reference site shipped on the same infra

### Testing bar (M7)

- [ ] **Performance**: Lighthouse CI gate on docs + reference site (perf ≥ 90, a11y ≥ 95)
- [ ] **Bundle**: size-limit gate; admin first-load JS ≤ 250 KB gzipped
- [ ] **A11y**: `@axe-core/playwright` zero serious violations on every admin route
- [ ] **Load test**: 1k concurrent reads + 50 concurrent writes on the playground for 5 min, p95 < 300ms
- [ ] **Full regression**: every E2E from M1–M6 still green
- [ ] Coverage final gate: every package ≥ 80% line, ≥ 70% branch

**Exit criterion**: 20-minute test #6 passes; public 0.1.0 release. Two real sites running on `content.voila.dev` infra for 30 days without incident → 1.0.

---

## Cross-cutting tracks (run in parallel with milestones)

These are not assigned to a single milestone; chip away each week.

- **Observability**: structured logs (`pino` or `bun:log`), OpenTelemetry traces, error reporting hook (Sentry-compatible). Lands incrementally M1–M5.
- **Security**: dependency audit on every PR (`bun audit`), `npm-audit`-style gate, CSP headers, rate limiting on `/admin/api/*`. Lands incrementally M1–M6.
- **DX**: `voila doctor` checks grow with every milestone; the command must always reflect the current set of expected bindings/env vars.

---

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

## How to help (when public)

- `products/content.voila.dev/apps/playground/` is where most contributions land first.
- Field types are the easiest entry point.
- Don't open "support Strapi-like X" issues. Open "I need to do X for my site" issues.

---

End of plan. Start at [03 — DX](./03-dx.md) if you only read one doc.
