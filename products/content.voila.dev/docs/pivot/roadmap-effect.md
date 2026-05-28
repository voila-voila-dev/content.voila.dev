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
- [x] Branch `effect`; product packages re-partitioned per Canon §3 (granular).
- [x] `effect` + `@effect/platform` + `@effect/sql` + `@effect/cli` added to the
  catalog; TS project references updated for the new package graph.
- [x] Lock-step changesets retained (`fixed: [["@voila/*"]]`).
- [x] `@effect/vitest` (or equivalent) wired so `Effect`/`Layer` specs run on
  `bun test`. (Using `bun test` directly per the "or equivalent" allowance.)

### `@voila/content-schema` (L1)
- [x] Field constructors as annotated `Schema`s: `string`, `number`, `boolean`,
  `date`, `datetime`, `json` (one file per field — preserve that convention).
  Bonus: `select` + `slug` shipped early (M2 in plan).
- [x] `VoilaField` annotation namespace (DB + UI metadata); `getFieldMeta`.
- [x] `InferDoc<>`; `defineField` for third-party fields.
- [x] `Schema.standardSchemaV1` export so the Head/forms get a Standard Schema.

### `@voila/content` (L2)
- [x] `defineContent` / `defineCollection` / `defineSingleton`.
- [x] `Service` skeletons + default `Layer`s for `DocumentService`,
  `MutationService`, `RbacService`, `HookService` (stubs; real impl M1+).

### `@voila/content-sql` + dialects (L3)
- [x] `Database` `Service` over `@effect/sql` `SqlClient`.
- [x] `@voila/content-sql/sqlite` (local), `@voila/content-sql/d1` (playground). `@voila/content-sql/pg`
  scaffold (impl M2).
- [x] `NoopDatabaseLive` — zero-dep `Database` Layer for M0 consumers that
  don't query yet (keeps `bun:sqlite` and the D1 binding out of the bundle).

### `@voila/content` (umbrella) + `@voila/content-cli`
- [x] `defineContent` composes the default `Layer` graph → `ManagedRuntime`.
- [x] `@voila/content-cli` on `@effect/cli`: `voila` binary, `doctor`, and `voila
  add` that materialises the M0 `admin-shell` + thin mount file. (`add` is no
  longer a stub: transitively resolves `registryDeps`, copies files, detects
  drift.)

### `@voila/content-registry` (Head, M0 slice)
- [x] `registry.json` scaffold + items: `admin-shell`, `route/admin-splat`,
  `server/mount`. Each = files + deps + registry-deps. Schema-validated
  manifest via `decodeManifest`.
- [x] Vended shell renders branding read from `content.config.ts`.

### Playground (canary)
- [x] TanStack Start + Cloudflare app; `voila add admin-shell` materializes real
  route files (no virtual routes).
- [x] `wrangler.jsonc` (D1 active; R2/Queues commented for M3/M5); `bun dev` →
  `:8787/admin`. (`bun dev` runs `vite build && wrangler dev --port 8787
  --local`; live boot verified — `<h1>Hello Playground</h1>` SSR'd from
  `content.config.ts`. `bun run dev:vite` keeps the Vite-native flow as an
  escape hatch.)

### Testing bar (M0)
- [x] **Unit (Effect):** `@voila/content-schema` constructors + decode/encode + Standard
  Schema contract — ≥ 90% line coverage. (Achieved **100 %** line on every file.)
- [x] **Unit:** `@voila/content` `Layer` wiring resolves with test doubles.
- [x] **Integration:** vended `admin/$.tsx` + thin mount hit via in-memory
  `Request`; asserts shell HTML.
- [x] **CI:** `bun run check` green (Biome + `tsc -b` + `bun test`). 111 tests
  / 0 fail / 259 expects.

**Exit:** `bun dev` in the playground renders the vended admin shell with config
branding; `voila add` produced real files; `bun run check` green. **✅ Achieved.**

---

## M1 — Read path: SQL → HttpApi → client → vended views (week 3–4)

### Engine
- [x] **`@voila/content-sql`:** schema→DDL generator from field annotations;
  system columns prepended (`id` ulid PK, `created_at`, `updated_at`,
  `deleted_at`); dialect-neutral `TableSchema[]` rendered to sqlite +
  postgres `CREATE TABLE` / `CREATE INDEX`. ULIDs minted by
  `Database.insert` (no DB default on `id`); `createdAt`/`updatedAt` keep
  DB-side defaults so raw INSERTs stay sane.
- [ ] **`@voila/content-sql`:** `voila migrate generate|apply` (sqlite +
  `--target d1-local|d1-remote`) via `@effect/sql/Migrator`.
- [ ] **`@voila/content/server`:** the `voilaRpc` `RpcGroup` definition
  (`@effect/rpc`); read procedures — `posts.list` (`?limit/cursor/orderBy`),
  `posts.find`, `posts.findOne`. Cursor pagination. Error envelope via typed
  `Rpc.Error` → envelope mapping. Mount at `/admin/api/rpc`.
- [ ] **`@voila/content/server`:** **Rpc→HttpApi derivation spike.** Attempt
  first-class derivation; if envelope / pagination / middleware semantics
  don't carry, ship a thin parallel `HttpApi` reusing the same `Schema`s and
  handler `Effect`s. Decision recorded as ADR.
- [ ] **`@voila/content/client`:** Effect-native typed client derived via
  `RpcClient.make`; `client.posts.find/findOne/list` return `Effect`/`Stream`.
  Thin `createAsyncClient` sugar for non-atom call sites. Type tests.
- [ ] **`@voila/content-auth`:** Better Auth bridged as a `Layer`; magic-link mailer
  `Layer` (Resend→SMTP→console); session as `Rpc.Middleware` (and on the
  derived HttpApi).

### Head (registry items)
- [ ] `lib/voila-atoms` registry item — per-collection atom factory derived
  from `@voila/content/client/atoms`. **Backend = RPC client (`@effect/rpc`)
  in M1; swapped to `@effect-atom/atom-livestore` over the project LiveStore
  in M3** with identical atom shape, so vended components don't change when
  the sync engine lands.
- [ ] `collection-table` (TanStack Table, columns from `list.columns`; rows
  fed by an `Atom.pull` paginated atom), `collection-detail` (read-only
  renderers driven by `useAtomValue`), `singleton-view`, `sidebar` (from
  registry), skeletons + empty states, `login`.
- [ ] SSR read loaders forward the `Cookie` header **and pre-populate
  effect-atom via `Atom.set` so the client hydrates without a fetch waterfall.**

### Testing bar (M1)
- [x] **Unit:** schema→DDL generator — golden files per field type. Goldens
  committed under `src/ddl/__golden__/all-fields.{sqlite,postgres}.sql`;
  `UPDATE_GOLDENS=1 bun test` regenerates. 123/0 fail at commit.
- [ ] **Integration (RPC):** read procedures against real SQLite (per-test
  file) using a test `Layer`; in-memory RPC transport.
- [ ] **Integration (D1):** read procedures against `wrangler dev`/Miniflare D1.
- [ ] **Type:** client inference (`tsd`-style) — both RPC client and
  `createAsyncClient` sugar.
- [ ] **Type / runtime (derivation):** Rpc→HttpApi derivation produces the
  same envelope shape as the RPC client per procedure; OpenAPI export
  round-trips.
- [ ] **Unit (atom):** atom factory — `Atom.runtime`-backed test that a list
  atom decodes envelope, surfaces typed errors, and invalidates on mutation
  event via `Reactivity`.
- [ ] **E2E:** magic-link login (console mailer) → browse list → open detail.
- [ ] Coverage gate: `@voila/content-schema` ≥ 90%, engine core ≥ 70%.

**Exit:** 20-min test #1 passes; `bun test` (unit+integration+E2E) < 8 min in CI.

---

## M2 — Write path (week 5–6)

### Engine
- [ ] **`@voila/content/server`:** write **procedures** on `voilaRpc` —
  `posts.create`, `posts.update` (partial via `Schema` partial),
  `posts.delete` (`hard?: true` purge), `posts.restore`. Unique violation →
  typed `ConflictError` mapped to envelope `code: "CONFLICT"`.
- [ ] **Validation:** one `Schema` decode shared client+server; failure →
  `ValidationError` envelope (`code: "VALIDATION"` + `{ fields }`).
- [ ] **CSRF** (HMAC double-submit) + **session enforcement** as
  `Rpc.Middleware` on every mutation procedure (reads keep session-only).
- [ ] **`@voila/content-sql/pg`:** Postgres `Layer`; migration parity; `voila migrate
  apply --target postgres --db <url>`.

### Head (registry items)
- [ ] Field widgets: `string`, `number`, `boolean`, `date`/`datetime`,
  `select`, `slug` (each a registry item under `field/*`, each driven by an
  **`effect-form` field atom**).
- [ ] `collection-form` (**`FormReact.make`** from `effect-form`) + widget
  host (label/description/error/aria); field- and form-level errors + retry.
  **Validation schema = the same `effect/Schema` the server runs in
  `MutationService.validateWrite`.**
- [ ] Optimistic updates via **`Reactivity` (effect-atom) invalidation** +
  toasts; last-write-wins on `updatedAt`. (TanStack DB optional; revisit only
  if `Reactivity` is insufficient.)

### Lifecycle
- [ ] Collection hooks (`before/after` × create/update/delete) via `HookService`.
- [ ] Audit log (`_voila_audit`); Trash page (restore + purge).

### Testing bar (M2)
- [ ] **Unit:** each widget renders/accepts input/surfaces errors.
- [ ] **Unit:** hook ordering + short-circuit (pure `Effect` specs).
- [ ] **Unit (form parity):** property test that the same `Schema` produces
  the same error shape on `effect-form` (client) and `HttpApiBuilder` (server).
- [ ] **Integration:** CRUD against SQLite **and** Postgres (CI matrix).
- [ ] **Integration:** optimistic rollback on server error (Reactivity-driven).
- [ ] **Integration:** `effect-form` `.refineEffect` cross-field validator
  hitting a server uniqueness check via the typed client.
- [ ] **E2E:** create → edit → delete → restore → purge.
- [ ] **Property (`fast-check`):** roundtrip arbitrary valid docs.
- [ ] Coverage gate: engine core ≥ 80%.

**Exit:** full CRUD on `posts` from the vended admin with validation +
optimistic UI; Postgres matrix green.

---

## M3 — Local-first sync + rich content & media (week 7–8)

### Sync engine
- [ ] **`@voila/content-sync`** (new package, see Canon §10 +
  [packages/content-sync.md](./packages/content-sync.md)): `Sync` Service tag;
  default Layer `LiveStoreCfLive` wires `@livestore/sync-cf` (DO + D1 event log)
  + `@livestore/adapter-web` (browser OPFS / WASM SQLite / Web Worker). Session
  enforcement on WebSocket upgrade; CSRF token verified on first message.
- [ ] **Event materializer:** DO `onPush` calls `MutationService.validateWrite`;
  failures emit a typed `ValidationError` envelope back to the client (same
  shape as REST 422). `RbacService` predicates run on the event author session.
  D1 event log is canonical; query tables are projections.
- [ ] **`@voila/content/client/atoms`** swap: list/detail atoms now dispatch
  through **`@effect-atom/atom-livestore`** against the project's LiveStore
  (reactive SQL view); mutation atoms commit LiveStore events instead of
  invoking RPC mutation procedures. No change required in vended Head code —
  atom shapes are identical to M1.
- [ ] **Three-way convergence:** RPC mutation procedures and the derived
  HttpApi handler keep working — both internally call `MutationService.validateWrite`
  → `Sync.append`, so RPC, HttpApi (MCP HTTP transport / `--eject-server`),
  and LiveStore commits all converge on a single event log + single projection.
- [ ] **Vended `lib/livestore.ts`:** `admin-shell` now vends `app/lib/livestore.ts`
  wiring the project schema + `makeCfSync({ url: "/admin/api/sync" })`; users
  can swap the URL or add headers without ejecting the engine.

### Rich content & media
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
- [ ] **Integration (sync):** LiveStore round-trip — client commits event → DO
  validates via `MutationService.validateWrite` → event appended → reactive
  query updates client. Includes failure path (Schema reject → typed
  `ValidationError` envelope).
- [ ] **Integration (three-way convergence):** RPC `posts.create`, the
  derived HttpApi `POST /admin/api/posts`, and a LiveStore
  `commit(createPost)` all produce identical event log entries; consumer
  projection converges.
- [ ] **Chaos:** kill the DO mid-write → event re-delivered without duplicate
  (idempotency key on event id).
- [ ] **Security:** unauthenticated WS upgrade rejected with 4401; CSRF token
  mismatch closes socket.
- [ ] Unit: editor plugins → HTML/markdown; variant pipeline (golden image diff).
- [ ] Integration: upload→variant→fetch via Miniflare R2 and via S3/MinIO.
- [ ] E2E: drag image into rich text → publish → render on public site.
- [ ] Perf: variant < 2s p95 for 2 MB JPEG.

**Exit:** post with cover + rich body renders on the public playground;
variants generate on demand and cache in R2; admin reads/writes go through
LiveStore; REST endpoints converge on the same event log.

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
  tools/resources derived from `voilaRpc` (procedure metadata maps cleanly to
  MCP tools; descriptions sourced from the derived OpenAPI annotations);
  streaming via the same `Rpc` `Stream` surface.
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

## M8 — WordPress import (week 17–18)

Goal: `voila import wordpress --url <site>` ingests a live WordPress site and
migrates it into Voila — inferring a schema, mapping content, and landing
typed documents with media — in one command (no plugin install on the source).

### `@voila/content-wordpress` (importer)
- [ ] Source adapter: discover + read via the WP REST API (`/wp-json/wp/v2/*`,
  cursor/`X-WP-Total` pagination, ETag caching); fall back to a WXR (`wp.xml`)
  export upload when REST is disabled or auth-gated.
- [ ] Schema inference: derive `defineCollection`s from WP post types (`posts`,
  `pages`, CPTs) + taxonomies (categories, tags) → `relation` fields; map ACF /
  registered meta to typed fields (sniff `string`/`number`/`boolean`/`date`/
  `select`); emit a reviewable schema diff before write (`--dry-run`).
- [ ] Content mapping: Gutenberg blocks + classic HTML → the `@voila/rich-text`
  AST (one converter per core block; unknown blocks preserved as raw-HTML
  nodes, logged); shortcodes flagged; `slug`/`status`/`date`/author/excerpt/
  featured-image carried over.
- [ ] Media: stream the media library to the configured store; rewrite in-body
  URLs to the new asset paths; dedupe by content hash.
- [ ] Idempotent + resumable: WP IDs recorded in an import manifest so re-runs
  upsert (not duplicate); `--since` for incremental syncs; redirect map
  (old permalink → new slug) emitted for the host.
- [ ] CLI: `voila import wordpress --url <site> [--wxr <file>] [--dry-run]
  [--collection-map <file>]`; progress + a final report (counts, skipped,
  warnings, unmapped blocks/meta).

### Testing bar (M8)
- [ ] Block-converter goldens (fixture WXR + REST captures → expected docs);
  schema-inference snapshots across post types/taxonomies/ACF; pagination +
  resume + idempotent re-run tests; media rewrite + dedupe; permalink
  redirect-map correctness; E2E: import a seeded WP instance, assert typed docs
  render in the admin and via `client.posts`.

**Exit:** a real WordPress blog (posts, pages, ≥1 CPT, media, taxonomies)
imports clean; re-run is a no-op; content renders with no data loss beyond
logged unmapped blocks.

> Scope note: this is a **single-source** WordPress importer, not the
> general "multi-CMS migrators" excluded in the non-goals below.

---

## Decommission track (runs M0–M2)

Because the new names reuse most existing ones (Canon §3 migration note), this is
mostly **rewrite-in-place**, not delete-and-replace:

- [ ] Port every test/golden file from the current packages to the new ones.
  (M0 surface in place; golden files land with the DDL generator in M1.)
- [x] **Rewrite in place** (same name, Effect internals): `@voila/content-schema`,
  `@voila/content`, `@voila/content-auth`, `@voila/content-cli`.
  (M0 scaffolds + tests on `effect`; real bodies layered in per milestone.)
- [x] **Rename:** `@voila/content-database` (Drizzle) → `@voila/content-sql`
  (`@effect/sql` + dialect subpaths). Remove Drizzle once parity is reached.
  (Drizzle is gone from the branch; `@voila/content-sql` ships `/d1`, `/pg`,
  `/sqlite` subpaths.)
- [x] **Fold:** the old standalone `@voila/content-client` → `@voila/content/client`.
- [ ] **Salvage** the React/admin half of `@voila/content` + `@voila/ui` into
  `@voila/content-registry` items; retire the `voila()` virtual-route vite plugin.
  (M0 vended `admin-shell`, `route/admin-splat`, `server/mount` items shipped;
  remaining UI lands with the M1+ Head work.)
- [x] Delete the superseded code paths **only once the replacement reaches
  parity** — never before. (M0-surface parity confirmed: tree no longer
  contains `@voila/content-database` or `@voila/content-client`.)
- [ ] Remove TanStack Query from registry items as M1 atoms land; remove
  TanStack Form as M2 effect-form lands; retire REST polling patterns when M3
  LiveStore lands. TanStack Router + TanStack Table remain.

## Cross-cutting (every week)

- Observability (structured logs, OTel via `@effect/opentelemetry`, error hook).
- Security (`bun audit` gate, CSP, rate limiting as `HttpApiMiddleware`).
- DX: `voila doctor` grows with every milestone.

## Explicit non-goals (unchanged)

No-code schema editor · landing-page builder · multi-CMS migrators · anything
proprietary in core.
