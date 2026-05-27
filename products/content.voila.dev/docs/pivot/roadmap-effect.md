# Roadmap — Effect Rebuild (A′)

> Supersedes [`requirements/12-deprecated-roadmap.md`](../requirements/12-deprecated-roadmap.md).
> Reads against the [Effect Architecture Canon](./effect-architecture-canon.md)
> and [registry boundary = A′](./registry-boundary-options.md).
>
> **Migration stance (assumed, confirm before M0):** rebuild on the `effect`
> branch as a fresh v2. The current tested M0–M2 packages stay as a *reference
> oracle* — their tests and golden files are ported, their React/UI is salvaged
> into `@voila/content-registry` — and are deleted once the new packages reach parity.

Milestone-based. Cut features before quality. Each milestone has a **testing
bar** that must pass (all on `bun test`; E2E via Playwright driven from
`bun test`). Capacity assumption: **1 FTE**. Slip the date, never the exit
criterion.

The pivot adds two cross-cutting realities to every milestone:

- **Engine = Effect, Head = vended.** Engine work means `Service`/`Layer` +
  `Schema`; Head work means authoring registry items (TanStack/React).
- **Two test surfaces.** Engine packages test with `@effect/vitest`-style specs
  on `bun test` (pure `Effect` + `Layer` test doubles). The Head tests as
  vended files inside the playground.

---

## M0 — Effect foundations & granular scaffold (week 1–2)

Goal: `bun dev` boots the playground on Cloudflare (`@cloudflare/vite-plugin`
+ Miniflare) with an empty admin shell **vended** (not virtual), backed by an
Effect runtime that resolves an empty config.

### Tooling & layout
- [ ] Branch `effect`; product packages re-partitioned per Canon §3 (granular).
- [ ] `effect` + `@effect/platform` + `@effect/sql` + `@effect/cli` added to the
  catalog; TS project references updated for the new package graph.
- [ ] Lock-step changesets retained (`fixed: [["@voila/*"]]`).
- [ ] `@effect/vitest` (or equivalent) wired so `Effect`/`Layer` specs run on
  `bun test`.

### `@voila/content-schema` (L1)
- [ ] Field constructors as annotated `Schema`s: `string`, `number`, `boolean`,
  `date`, `datetime`, `json` (one file per field — preserve that convention).
- [ ] `VoilaField` annotation namespace (DB + UI metadata); `getFieldMeta`.
- [ ] `InferDoc<>`; `defineField` for third-party fields.
- [ ] `Schema.standardSchemaV1` export so the Head/forms get a Standard Schema.

### `@voila/content` (L2)
- [ ] `defineContent` / `defineCollection` / `defineSingleton`.
- [ ] `Service` skeletons + default `Layer`s for `DocumentService`,
  `MutationService`, `RbacService`, `HookService` (stubs; real impl M1+).

### `@voila/content-sql` + dialects (L3)
- [ ] `Database` `Service` over `@effect/sql` `SqlClient`.
- [ ] `@voila/content-sql/sqlite` (local), `@voila/content-sql/d1` (playground). `@voila/content-sql/pg`
  scaffold (impl M2).

### `@voila/content` (umbrella) + `@voila/content-cli`
- [ ] `defineContent` composes the default `Layer` graph → `ManagedRuntime`.
- [ ] `@voila/content-cli` on `@effect/cli`: `voila` binary, `doctor`, and a stub
  `voila add` that can vend the M0 `admin-shell` + thin mount file.

### `@voila/content-registry` (Head, M0 slice)
- [ ] `registry.json` scaffold + items: `admin-shell`, `route/admin-splat`,
  `server/mount`. Each = files + deps + registry-deps.
- [ ] Vended shell renders branding read from `content.config.ts`.

### Playground (canary)
- [ ] TanStack Start + Cloudflare app; `voila add admin-shell` materializes real
  route files (no virtual routes).
- [ ] `wrangler.jsonc` (D1 active; R2/Queues commented for M3/M5); `bun dev` →
  `:8787/admin`.

### Testing bar (M0)
- [ ] **Unit (Effect):** `@voila/content-schema` constructors + decode/encode + Standard
  Schema contract — ≥ 90% line coverage.
- [ ] **Unit:** `@voila/content` `Layer` wiring resolves with test doubles.
- [ ] **Integration:** vended `admin/$.tsx` + thin mount hit via in-memory
  `Request`; asserts shell HTML.
- [ ] **CI:** `bun run check` green (Biome + `tsc -b` + `bun test`).

**Exit:** `bun dev` in the playground renders the vended admin shell with config
branding; `voila add` produced real files; `bun run check` green.

---

## M1 — Read path: SQL → HttpApi → client → vended views (week 3–4)

### Engine
- [ ] **`@voila/content-sql`:** schema→table generator from field annotations; system
  columns (`id` ulid, `createdAt`, `updatedAt`, `deletedAt`); `voila migrate
  generate|apply` (sqlite + `--target d1-local|d1-remote`) via `Migrator`.
- [ ] **`@voila/content/server`:** the `HttpApi` definition; read endpoints as
  `HttpApiEndpoint`s — list (`?limit/cursor/orderBy`), find by id, find by
  unique field. Cursor pagination. Error envelope via typed-error mapping.
- [ ] **`@voila/content/client`:** typed client derived via `HttpApiClient`;
  `client.posts.find/findOne/list`. Type tests.
- [ ] **`@voila/content-auth`:** Better Auth bridged as a `Layer`; magic-link mailer
  `Layer` (Resend→SMTP→console); session as `HttpApiMiddleware`.

### Head (registry items)
- [ ] `collection-table` (TanStack Table, columns from `list.columns`),
  `collection-detail` (read-only renderers), `singleton-view`, `sidebar`
  (from registry), skeletons + empty states, `login`.
- [ ] SSR read loaders forward the `Cookie` header.

### Testing bar (M1)
- [ ] **Unit:** schema→DDL generator — golden files per field type (ported).
- [ ] **Integration:** read endpoints against real SQLite (per-test file) using
  a test `Layer`.
- [ ] **Integration (D1):** read endpoints against `wrangler dev`/Miniflare D1.
- [ ] **Type:** client inference (`tsd`-style).
- [ ] **E2E:** magic-link login (console mailer) → browse list → open detail.
- [ ] Coverage gate: `@voila/content-schema` ≥ 90%, engine core ≥ 70%.

**Exit:** 20-min test #1 passes; `bun test` (unit+integration+E2E) < 8 min in CI.

---

## M2 — Write path (week 5–6)

### Engine
- [ ] **`@voila/content/server`:** write endpoints — create (201), partial update
  (PATCH semantics via `Schema` partial), soft delete (`?hard=true` purge),
  restore. Unique violation → 409.
- [ ] **Validation:** one `Schema` decode shared client+server; failure →
  422 `VALIDATION` with `{ fields }`.
- [ ] **CSRF** (HMAC double-submit) + **session enforcement** as
  `HttpApiMiddleware` on every data endpoint.
- [ ] **`@voila/content-sql/pg`:** Postgres `Layer`; migration parity; `voila migrate
  apply --target postgres --db <url>`.

### Head (registry items)
- [ ] Field widgets: `string`, `number`, `boolean`, `date`/`datetime`,
  `select`, `slug` (each a registry item under `field/*`).
- [ ] `collection-form` (TanStack Form) + widget host (label/description/error/
  aria); field- and form-level errors + retry.
- [ ] Optimistic updates (TanStack DB) + toasts; last-write-wins on `updatedAt`.

### Lifecycle
- [ ] Collection hooks (`before/after` × create/update/delete) via `HookService`.
- [ ] Audit log (`_voila_audit`); Trash page (restore + purge).

### Testing bar (M2)
- [ ] **Unit:** each widget renders/accepts input/surfaces errors.
- [ ] **Unit:** hook ordering + short-circuit (pure `Effect` specs).
- [ ] **Integration:** CRUD against SQLite **and** Postgres (CI matrix).
- [ ] **Integration:** optimistic rollback on server error.
- [ ] **E2E:** create → edit → delete → restore → purge.
- [ ] **Property (`fast-check`):** roundtrip arbitrary valid docs.
- [ ] Coverage gate: engine core ≥ 80%.

**Exit:** full CRUD on `posts` from the vended admin with validation +
optimistic UI; Postgres matrix green.

---

## M3 — Rich content & media (week 7–8)

- [ ] **`@voila/content-storage`:** `Storage` `Service` + R2/S3 `Layer`s (S3 vs MinIO in
  CI); presigned uploads; public-URL strategy.
- [ ] `field/media` registry item: drag-drop, multipart > 5 MB, client validate,
  progress/cancel; media-library page.
- [ ] Image variants: config DSL, Cloudflare Images detection, Wasm fallback
  (`@jsquash`), lazy generation cached in R2, orphan tracking.
- [ ] Rich text: `field/rich-text` wires `@voila/rich-text-editor` (+ `/nodes`);
  default plugins; markdown roundtrip; SSR read path; `field/markdown`,
  `field/code` (Shiki).

### Testing bar (M3)
- [ ] Unit: editor plugins → HTML/markdown; variant pipeline (golden image diff).
- [ ] Integration: upload→variant→fetch via Miniflare R2 and via S3/MinIO.
- [ ] E2E: drag image into rich text → publish → render on public site.
- [ ] Perf: variant < 2s p95 for 2 MB JPEG.

**Exit:** post with cover + rich body renders on the public playground; variants
generate on demand, cache in R2.

---

## M4 — Relations, i18n, drafts (week 9–10)

- [ ] Relations: `relation` (one/many-to-one), `relations` (m2m + join),
  polymorphic; searchable combobox; `include` across HTTP + client; cascade rules.
- [ ] i18n: `localized: true` per field (storage shape flip, in `@voila/content`);
  locale tabs; per-locale validation; Paraglide/Inlang message sync via
  **`voila i18n`** (`@voila/content-cli`); locale-aware lists.
- [ ] Drafts/versioning: `draft`/`publishedAt`; `_voila_versions`; save=version,
  publish=bump; version list + diff + restore; scheduled publish (cron-checked
  until M5).

### Testing bar (M4)
- [ ] Relation resolver: cycles + N+1 detection; `include` shapes (`tsd`).
- [ ] Localized store/fallback; version diff/restore (SQLite + Postgres).
- [ ] E2E: schedule publish +1 min; EN→FR translate + locale switch on public site.

**Exit:** 20-min tests #2 (relations), #3 (i18n), #4 (drafts) pass.

---

## M5 — Extensions & background work (week 11–12)

- [ ] Extension APIs: `defineWidget` (freeze type), `definePage`, `defineAction`;
  **plugins as `Layer`s** (`layers: [auditPro()]`) + lifecycle.
- [ ] **`@voila/content`:** task `Service`; Cloudflare Queues + inline `Layer`s;
  retry/backoff DSL; DLQ page; observability.
- [ ] Cron DSL; `voila migrate` patches `triggers.crons`; `scheduled()` dispatcher.
- [ ] Webhooks: `defineWebhook`; HMAC signing; retry via queue; delivery log.
- [ ] Built-in tasks: `publish-scheduled`, `gc-versions`, `gc-trash`,
  `media-process`, `gc-media-orphans`.

### Testing bar (M5)
- [ ] Queue adapter contract suite (inline + CF local); scheduled publish
  (mocked clock); webhook HMAC; DLQ routing; chaos: kill mid-task → retried not
  duplicated (idempotency key).

**Exit:** 20-min test #5 passes; built-in tasks clean over a 24h soak.

---

## M6 — MCP & RBAC (week 13–14)

- [ ] **`@voila/content-mcp`:** HTTP transport at `/admin/api/mcp` + stdio (`voila mcp`);
  tools/resources generated from schema + `HttpApi`/OpenAPI; streaming.
- [ ] MCP auth: bearer/API keys; OAuth 2.1 PKCE via Better Auth; scope DSL; token
  revocation UI.
- [ ] RBAC: role model; doc- and field-level access folded into the SQL `WHERE`
  via `RbacService` predicates; field redaction (absent, not nulled); API-keys UI.

### Testing bar (M6)
- [ ] Scope→predicate compiler; full MCP handshake (HTTP + stdio); OAuth PKCE
  happy + error cases; doc/field access matrix; token-leakage tests; E2E: Claude
  Code lists/creates/edits a post over MCP.

**Exit:** Claude Code connects, lists collections, CRUD a post with full type
safety; RBAC denies visible in audit log.

---

## M7 — Polish & docs (week 15–16)

- [ ] Search: D1 FTS5 + Postgres FTS parity; `client.posts.search()`; Cmd+K.
- [ ] Import/export: `voila export|import` (json/csv, dry-run, schema-aware diff).
- [ ] Live preview: `VoilaRoom` Durable Object; preview-token signing; WS draft
  sync; public preview URL.
- [ ] Polish: empty states, error boundaries, skeletons (no CLS), a11y pass, TTI
  < 2s for 1k-row list, per-package bundle budgets.
- [ ] Docs site live at content.voila.dev; all requirements ported; API reference
  auto-generated; ≥ 1 real reference site.
- [ ] **Registry polish:** `voila diff`/upgrade UX; `--eject-server` documented;
  registry items versioned.

### Testing bar (M7)
- [ ] Lighthouse gate (perf ≥ 90, a11y ≥ 95); size-limit (admin first-load ≤ 250
  KB gz); axe zero serious; load test (1k reads + 50 writes, 5 min, p95 < 300ms);
  full M1–M6 regression; coverage final ≥ 80% line / 70% branch.

**Exit:** 20-min test #6 passes; public 0.1.0. Two real sites running 30 days →
1.0.

---

## Decommission track (runs M0–M2)

Because the new names reuse most existing ones (Canon §3 migration note), this is
mostly **rewrite-in-place**, not delete-and-replace:

- [ ] Port every test/golden file from the current packages to the new ones.
- [ ] **Rewrite in place** (same name, Effect internals): `@voila/content-schema`,
  `@voila/content`, `@voila/content-auth`, `@voila/content-cli`.
- [ ] **Rename:** `@voila/content-database` (Drizzle) → `@voila/content-sql`
  (`@effect/sql` + dialect subpaths). Remove Drizzle once parity is reached.
- [ ] **Fold:** the old standalone `@voila/content-client` → `@voila/content/client`.
- [ ] **Salvage** the React/admin half of `@voila/content` + `@voila/ui` into
  `@voila/content-registry` items; retire the `voila()` virtual-route vite plugin.
- [ ] Delete the superseded code paths **only once the replacement reaches
  parity** — never before.

## Cross-cutting (every week)

- Observability (structured logs, OTel via `@effect/opentelemetry`, error hook).
- Security (`bun audit` gate, CSP, rate limiting as `HttpApiMiddleware`).
- DX: `voila doctor` grows with every milestone.

## Explicit non-goals (unchanged)

No-code schema editor · landing-page builder · multi-CMS migrators · anything
proprietary in core.
