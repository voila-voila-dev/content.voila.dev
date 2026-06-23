# Roadmap

Milestone-based, ~1 FTE. Slip the date, never the exit criterion. Every phase
ships with `bun test` green. The engine is plain TypeScript (Effect removed) —
see [tech decisions](./tech-decisions.md).

## Done

| Phase | What shipped |
| --- | --- |
| **0 — Schema & fields** | `defineConfig`/`defineCollection`/`defineSingleton`; ~25 field constructors (one file each); zero-dep Standard Schema validators; localized fields; `InferDoc`/`InferSingleton`, no codegen |
| **1 — CLI & SQL** | DDL generator (SQLite + Postgres dialects); migration journal; `voila migrate generate`/`apply` (SQLite + D1) |
| **2 — Server & client** | Runtime `Database` (CRUD, keyset pagination) over a `SqlDriver` seam; REST read+write with typed error envelope; typed client inferred from config; auth seam + signed CSRF; Better Auth bridge + magic-link over a `Mailer` seam |
| **3 — UI** | `@voila/ui` primitives (shadcn-on-Base-UI, Tailwind v4 tokens, dark mode); `@voila/content-ui` schema-aware blocks (DataTable, CollectionForm, FieldRenderer, AdminShell, List/DetailView, dashboard) |
| **4 — Vending** *(superseded)* | `@voila/content-registry` + `voila add/list/diff` shipped, then **removed** — the pure-config framework (Phase 6) replaces shadcn-style vending. The CLI is now `voila migrate` only |
| **5 (partial)** | Auth-by-default scaffold; media (Storage seam + memory/fs/R2/S3); image transforms (`ImageCdn` URL seam); i18n delivery (`?locale=` + fallback graph); drafts + scheduled publish (query-time go-live, no cron); version history (`voila_revisions`); per-field RBAC; full-text search (SQLite/D1 FTS5); rich-text editor (Plate) |
| **6 — Admin framework & Cloudflare deploy** | `@voila/content-admin`: a config-driven admin on TanStack Start — `defineAdmin` + dynamic `$collection` screens (add a collection = zero new files), file-free custom screens/slots/nav, `createWorkerAdmin` (D1 + R2 + Better Auth). **Pure config, no eject** ([ADR 0003](./decision-records/0003-admin-framework-package.md)); root-mounted (the admin is the whole site). **One Worker · one D1 · one R2 · one subdomain per site.** `bun create content-voila` scaffolds a deployable app (~handful of fixed files); update every site with one version bump |

## Shipped to npm

All packages are published; `bun create content-voila <dir>` works from npm alone
(verified end-to-end: scaffold → install → `bun run build` workerd bundle →
`tsc --noEmit` clean, with no manual fixes):

`@voila/content` · `@voila/content-ui` · `@voila/content-admin` ·
`@voila/content-cli` · `create-content-voila` (+ `@voila/ui`,
`@voila/rich-text-editor` from their own repos).

## Now — polish

- [x] `@voila/ui@0.2.0`: dropped the barrel entirely — every component is now its own subpath export (`@voila/ui/button`, `@voila/ui/chart`, …), so importing one no longer pulls the `recharts`/`react-hook-form` optional peers. Template + demo no longer install them.
- [ ] CI gate: external `bun create content-voila` → build + typecheck (the smoke test, automated)
- [ ] Close the remaining [DX](./dx-review.md) and [UI/UX](./ui-ux-review.md) review items

## Next — Phase 5 remainder

- [ ] Edit widgets for relation / array / object (the "serious CMS" gap)
- [ ] `voila seed` / `voila doctor` (doctor detects the open-mount / missing-secret cases)
- [ ] MCP server over the config (the typed config makes it nearly free — on-brand for the AI-agent story)
- [ ] Audit log; import/export (JSON/CSV)
- [ ] Webhooks / background tasks / cron (the "went-live" event for scheduled publish)
- [ ] Live preview (Cloudflare Durable Object channel)

**Exit:** day-one feature parity with serious headless CMSes — config-first.

## Out of scope

Visual page builder, marketing-site builder, hosted SaaS tier. Run it yourself;
pay Cloudflare.

→ [Philosophy](./philosophy.md) · [DX](./dx.md) · [Tech Decisions](./tech-decisions.md)
