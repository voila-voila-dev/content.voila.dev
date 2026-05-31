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
- [x] **`@voila/content-sql`:** `voila migrate generate|apply` (sqlite +
  `--target d1-local|d1-remote`) via `@effect/sql/Migrator`. `generate` derives
  the full DDL (no diffing yet — M4+) into `migrations/NNNN_name.sql`; `apply`
  runs them through a custom `.sql` loader (journal = `effect_sql_migrations`).
  D1 can't bind a `SqlClient` from a CLI, so `d1-local|d1-remote` shell out to
  `wrangler d1 migrations apply --local|--remote` over the same files
  (tracked in D1's `d1_migrations`). CLI on `@effect/cli` under the Bun platform
  layer. Lives in `@voila/content` subpaths (`/sql`, `/cli`), not split-out
  packages yet.
- [x] **`@voila/content/server`:** the `voilaRpc` `RpcGroup` definition
  (`@effect/rpc`); read procedures — `posts.list` (`?limit/cursor/orderBy`),
  `posts.find`, `posts.findOne`. Cursor pagination. Error envelope via typed
  `Rpc.Error` → envelope mapping. Mount at `/admin/api/rpc`. (Group generated
  per-collection (`<slug>.list|find|findOne`); **typed from the config** — the
  runtime builds the group dynamically but its type is derived via
  `VoilaRpcs<typeof config>` (mapped type reusing each collection's field schemas
  through `InferFields`), so `RpcClient`/`RpcTest` nest dotted tags into a fully
  typed `client.posts.find({id}): Effect<Post, NotFound>` — no codegen, no facade.
  Procedures carry the real per-collection document `Schema` (`systemColumns` +
  fields); handlers decode rows through it. `find`=by-id → `NotFound`,
  `findOne`=by-field → nullable. Added a `Database.findOne(field)` primitive.
  Typed errors `NotFound`/`BadRequest`/`InternalError` (`Schema.TaggedError`) +
  `toErrorEnvelope` → `{ error: { code, ... } }`. Mount is an `HttpApp` via
  `RpcServer.toHttpApp` (`toVoilaRpcHttpApp`, JSON serialization) so the platform
  runtime stays in the host. Lives in the `@voila/content` `/server` subpath.)
- [x] **`@voila/content/server`:** **Rpc→HttpApi derivation spike.** Attempt
  first-class derivation; if envelope / pagination / middleware semantics
  don't carry, ship a thin parallel `HttpApi` reusing the same `Schema`s and
  handler `Effect`s. Decision recorded as ADR. (No derivation exists in
  `@effect/rpc@0.75.1` → shipped a **thin parallel `HttpApi`** (`server/httpapi.ts`)
  sharing a new `server/read-core.ts` (`makeReadCore`) + the same document/payload/
  error schemas with the RPC group. Per-collection GET endpoints; envelope errors
  with stable status (404/400/500/401); `HttpSessionMiddleware` reuses
  `Auth.requireSession`; `voilaOpenApi` via `OpenApi.fromApi`. ADR
  `docs/pivot/adr/0001-rpc-to-httpapi.md`.)
- [x] **`@voila/content/client`:** Effect-native typed client derived via
  `RpcClient.make`; `client.posts.find/findOne/list` return `Effect`/`Stream`.
  Thin `createAsyncClient` sugar for non-atom call sites. Type tests. (`/client`
  subpath: `makeVoilaClient(config, {url})` = the typed nested `RpcClient` over an
  HTTP protocol (`Effect<VoilaClient<C>, never, Scope>`, run inside a scope);
  `createAsyncClient(config, {url})` = Promise sugar holding a long-lived scope,
  rejecting with the typed error via `Cause.squash`, `.dispose()` to tear down.
  Both fully typed from the config — no codegen. `list` returns an `Effect` of a
  cursor page (not a `Stream` yet — revisit if streaming pagination is needed).
  Type assertions inline. E2E over **real HTTP** (loopback `Bun.serve`) in
  `client/client.test.ts`.)
- [x] **`@voila/content-auth`:** Better Auth bridged as a `Layer`; magic-link mailer
  `Layer` (Resend→SMTP→console); session as `Rpc.Middleware` (and on the
  derived HttpApi). (Lives in the `@voila/content` `/auth` subpath, not a
  split-out package yet. `Auth` `Service` tag (`getSession`/`requireSession`/
  `handler`) — the engine depends on the tag, never on Better Auth, so
  `BetterAuthLive` is swappable for Clerk/custom JWT. **Better Auth bridged over
  the engine's `@effect/sql` `SqlClient`** via a custom `createAdapter`
  (single shared connection — no second driver/pool); the adapter converts
  date↔epoch-ms and boolean↔0/1 at the SQL boundary using Better Auth's
  authoritative per-column schema, and implements atomic `consumeOne`
  (`DELETE … RETURNING *`) for one-time magic-link tokens. Auth-table DDL
  (`authTableStatements`/`authTablesSql`) is **wired into the Migrator**: `voila
  migrate generate` appends the four Better Auth tables by default (`--no-auth`
  to omit; sqlite/d1 only — pg auth DDL is M2), so one `apply` provisions auth +
  collections. `Mailer` is a `Context.Tag`
  with `ConsoleMailerLive`/`ResendMailerLive`/`SmtpMailerLive` + env-driven
  `resolveMailerLayer`; the magic-link callback runs the resolved `Mailer` effect
  through the layer's captured `Runtime`. `SessionMiddleware` (`RpcMiddleware.Tag`)
  provides `CurrentSession` / fails typed `Unauthorized` (envelope
  `code: "UNAUTHORIZED"`). **Enforced on the mount** via `toVoilaRpcHttpApp(config,
  { …, auth })` — passing an `Auth` layer wraps the read group with
  `SessionMiddleware` and builds the middleware into the host scope; omit `auth`
  to serve unauthenticated (reads are session-only — CSRF lands on mutations in
  M2). The HttpApi half reuses `Auth.requireSession` once the Rpc→HttpApi
  derivation spike above lands — not built yet. Tested end to end: E2E magic-link
  flow (sign-in → verify → session) over the real Better Auth instance, plus a
  **real-HTTP enforcement** test (loopback `Bun.serve` + `RpcClient`) asserting
  no-cookie → typed `Unauthorized` off the wire and a minted session cookie →
  read succeeds; 19 specs.)
- [x] **Umbrella auto-wiring (`defineContent` + `makeHandler`).** `defineContent({
  branding, collections, database, auth?, secret?, env? })` composes the runtime
  `Layer` graph: the `Database` service over the given `SqlClient` connection
  and, when `auth` is set, `BetterAuthLive` with the `Mailer` **resolved from
  `env`** (Resend→SMTP→console) — both sharing that one connection. `secret` is
  required when `auth` is set (throws otherwise). `makeHandler(content)`
  (`@voila/content/server`) mounts the RPC app from the composed `Content`,
  enforcing the session automatically when auth is present. So a project gets
  auth + an enforced API from `content.config.ts` alone — no hand-wired layers.
  Playground realigned to this API. Tested: config normalization, auth
  presence/absence + secret-required throw, and an end-to-end pass where a
  magic-link session minted through `content.auth` (console mailer recovered via
  a `console.log` spy) is accepted by the `makeHandler` app while an
  unauthenticated read is rejected.)

### Head (registry items)
- [x] `lib/voila-atoms` registry item — per-collection atom factory derived
  from `@voila/content/client/atoms`. **Backend = RPC client (`@effect/rpc`)
  in M1; swapped to `@effect-atom/atom-livestore` over the project LiveStore
  in M3** with identical atom shape, so vended components don't change when
  the sync engine lands. (Engine half shipped: `@voila/content/client/atoms`
  exports `makeVoilaAtoms(config, { url })` → `{ runtime, collections }`, where
  `collections.<slug>.{list,find,findOne}` are `Atom.family`-memoized atoms
  yielding `Result<Doc, …>` over the typed `makeVoilaClient` (`@effect-atom/atom`
  `Atom.runtime` owning the RPC client; structural `Data.struct` keys dedupe by
  input). Typed from the config — no codegen. Tested in `client/atoms.test.ts`
  against a real loopback `Bun.serve` RPC app (list/find/findOne + typed
  `NotFound`, nullable `findOne`, structural memoization). **Vended file shipped:**
  `apps/playground/src/lib/voila-atoms.ts` = `makeVoilaAtoms(config, { url:
  "/admin/api/rpc" })`. Vended **directly into the playground** (no
  `@voila/content-registry` package this milestone — see decision below); the
  files carry the `// VENDED by @voila/content-registry` marker for when the
  registry packaging lands.)
- [x] `collection-table` (TanStack Table, columns from collection fields; rows
  from the `list` atom via `useAtomValue`), `collection-detail` (read-only field
  renderers), `sidebar` (collections from config), skeletons + empty + error
  states, `login` (magic-link). Vended into `apps/playground/src/{components,routes}`
  with Tailwind v4 + a small shadcn-style primitive set (`components/ui/*`). Routes
  are per-collection (`/admin/$collection`, `/admin/$collection/$id`) per the
  per-endpoint-route convention, not a splat. `singleton-view` **deferred** — the
  playground config has no singleton yet; it mirrors `collection-detail` over a
  `findOne`-style atom. **Decision:** vend directly (not via a registry package)
  for M1; build the `@voila/content-registry` packaging (`registry.json`, manifest,
  `voila add`) in a later milestone.
- [x] SSR read loaders forward the `Cookie` header **and pre-populate
  effect-atom so the client hydrates without a fetch waterfall.** Engine half:
  `makeVoilaAtoms` now wraps every `list`/`find`/`findOne` family member with
  `Atom.serializable({ key, schema })` under **deterministic keys**
  (`@voila/<slug>/<method>/<canonical-input>`) and a `Result.Schema` built from the
  same per-collection doc + error schemas the RPC procedures use — so a
  server-dehydrated `Registry` lines up with the browser atoms by key (auto-keys
  used to differ across instances). Proven by a round-trip unit test
  (`client/atoms.test.ts`): resolve a read in a "server" registry,
  `Hydration.dehydrate` it, then `Hydration.hydrate` a **fresh** registry whose
  atoms point at a *dead* URL and read them synchronously — they return `Success`
  (`waiting === false`) with the decoded document, i.e. the effect never ran (no
  fetch). Vended half (playground): `src/lib/voila-ssr.ts` exposes two
  `createServerFn` prefetchers that, during SSR only, re-issue the read in-worker
  with the visitor's `Cookie` forwarded (`getRequestHeader` + a cookie-injecting
  `FetchHttpClient` layer), settle the atom, and return the dehydrated payload as
  JSON; the `/admin/$collection` and `/admin/$collection/$id` loaders call them and
  wrap their views in `<HydrationBoundary>` (inside the admin `RegistryProvider`),
  so the list/detail atoms hydrate from the SSR payload and never fetch on mount.
  Server-only code is stripped from the client bundle (verified in `vite build`).
  Client-side navigation hydrates nothing and the atoms fetch themselves as before.
  (The admin layout's session **gate** is still a client-side check — a separate,
  intentional choice — so the shell briefly shows "Loading…" before the hydrated
  content paints; the read **data** no longer waterfalls.)

### Testing bar (M1)
- [x] **Unit:** schema→DDL generator — golden files per field type. Goldens
  committed under `src/ddl/__golden__/all-fields.{sqlite,postgres}.sql`;
  `UPDATE_GOLDENS=1 bun test` regenerates. 123/0 fail at commit.
- [x] **Integration (RPC):** read procedures against real SQLite (per-test
  file) using a test `Layer`; in-memory RPC transport. (`src/server/rpc.test.ts`
  via `RpcTest.makeClient` — the **typed** nested client (`client.posts.list/find/findOne`),
  which also proves config→client type flow: explicit field annotations fail `tsc`
  if mistyped. Covers list pagination, `find` NotFound, `findOne` nullable,
  `BadRequest` mapping; `:memory:` SQLite seeded per spec.)
- [x] **Integration (HTTP mount):** `toVoilaRpcHttpApp` served on a loopback
  `Bun.serve`, read by a real `RpcClient` over `FetchHttpClient` + JSON
  serialization (`src/server/mount.test.ts`) — exercises real wire framing, not
  just the in-memory `RpcTest` transport. (Surfaced + fixed a connection-lifetime
  bug: the mount now builds its layer into the ambient scope via `Layer.build`.)
- [x] **Unit (field round-trip + dialect):** `Type ≠ Encoded` fields
  (datetime/date/localized/boolean/duration) round-trip through the typed client
  (`src/server/rpc-fields.test.ts`); the `Database` read layer's `mapRow`
  normalizes both SQLite- and Postgres-shaped raw rows to one canonical document
  (`src/sql/database/maprow.test.ts`). **Live Postgres is NOT covered here** — the
  read-mapping *logic* is verified for pg-shaped values, but the pg client `Layer`
  + an against-real-Postgres test are M2 (see `@voila/content-sql/pg`), not claimed
  done in M1.
- [x] **Integration (D1):** read procedures against `wrangler dev`/Miniflare D1.
  (`sql/client/d1.test.ts` — **in-process Miniflare** (`miniflare@4`) D1 binding →
  `D1Live` (`@effect/sql-d1`) → the real `makeVoilaRpcHandlers` stack via `RpcTest`;
  opt-in `D1=1`. Chose in-process Miniflare over a spawned `wrangler dev` — same
  driver, faster, less flaky. The playground worker serving the endpoint over D1
  lands with the Head slice.)
- [x] **Type:** client inference (`tsd`-style) — both RPC client and
  `createAsyncClient` sugar. (Done as inline `tsc`-checked annotations in the e2e
  tests — `server/rpc.test.ts` (Effect client) + `client/client.test.ts` (async
  sugar): each asserts `doc.title: string` etc., failing the build if inference
  drifts. No separate `tsd` runner.)
- [x] **Type / runtime (derivation):** Rpc→HttpApi derivation produces the
  same envelope shape as the RPC client per procedure; OpenAPI export
  round-trips. (`server/httpapi.test.ts` — REST + RPC served over the same
  SQLite file on two loopback `Bun.serve`s; asserts equal documents per
  procedure, the 404 body `== toErrorEnvelope(rpcError)`, and
  `OpenApi.fromApi` paths/JSON round-trip. `server/httpapi.auth.test.ts` adds
  the 401 envelope/cookie case.)
- [x] **Unit (atom):** atom factory — `Atom.runtime`-backed test that a list
  atom decodes envelope and surfaces typed errors. (`client/atoms.test.ts` — real
  loopback `Bun.serve` RPC app driven through a `Registry`; list page / find doc /
  typed `NotFound` / nullable `findOne` / structural memoization. The
  **invalidate-on-mutation-event via `Reactivity`** leg is M2 — mutations don't
  exist on the read path yet.)
- [x] **E2E:** magic-link login (console mailer) → browse list → open detail.
  (`apps/playground/test/e2e/login-and-browse.test.ts` — Playwright Chromium
  against `wrangler dev --local` over local D1: `/admin` redirects to `/login`,
  submit email, grep the console-logged magic link from the worker stdout, follow
  it (session cookie set), click into `posts`, assert the seeded row renders, open
  its detail. Opt-in `E2E=1`; the `playwright` library inside `bun:test`, asserting
  via `Locator.waitFor` (no Playwright `expect` matchers). The earlier
  `auth/better-auth.test.ts` covers the auth leg at the unit level.)
- [x] Coverage gate: `@voila/content-schema` ≥ 90%, engine core ≥ 70%.
  (Root `test:cov:gates` runs `scripts/coverage-gate` twice over the single
  `@voila/content` package: engine core ≥ 70% (at ~94%) and the `config/schema`
  sub-tree ≥ 90% (at ~99%, via the gate's new path-filter arg). `content/bunfig.toml`
  emits the scoped lcov.)

**Exit:** 20-min test #1 passes; `bun test` (unit+integration+E2E) < 8 min in CI.
**✅ Achieved** — the login→browse→detail E2E passes against `wrangler dev` over
D1; `bun run check` green (engine core 94% & schema 99% coverage gates pass). The
previously-deferred SSR no-waterfall hydration item is now **done** (engine-side
stable atom keys + cookie-forwarding SSR prefetch + `HydrationBoundary`, above),
closing the last M1 Head item.

---

## M2 — Write path (week 5–6)

> **Status (2026-05-31): write-path vertical slice DONE on `effect`** — the engine
> write procedures, the CSRF/validation/conflict layer, and a working admin
> create/edit/delete UI are built natively in the Effect architecture (checked
> below). Still open: the live Postgres `Layer`, lifecycle (hooks/audit/Trash),
> `Reactivity`-driven optimistic updates, and the broader M2 test matrix
> (Postgres CRUD, fast-check, the form-parity property test, the write E2E).
>
> A *separate*, full M2 write path also exists on the **pre-pivot `main` branch**
> (Zod/drizzle/TanStack Form) — `main` was only a port reference; the effect
> implementation shares none of its code and differs in architecture (`effect/Schema`
> + `@effect/rpc` + `@effect/sql`). Notable effect-side divergences from the
> roadmap-as-written: there is **no `effect-form`/`MutationService`** — the form is
> plain controlled React validating against `Schema.Struct(fields)` directly (the
> same schema `write-core` runs), and write payloads are `{ data }`-permissive on the
> wire with handler-side validation (so the `VALIDATION` envelope carries `{ fields }`
> while the typed client return stays the document).

### Engine
- [x] **`@voila/content/server`:** write **procedures** on `voilaRpc` —
  `<slug>.create`, `<slug>.update` (partial via `Schema.partial`),
  `<slug>.delete` (`hard?: true` purge), `<slug>.restore`. Unique violation →
  typed `ConflictError` (with the offending `field`) mapped to envelope
  `code: "CONFLICT"`. (Built per-collection at runtime but **typed from the config**
  like the reads — `VoilaRpcs<C>` gained the write quartet, so `client.posts.create(…)`
  exists with no codegen. `Database` gained `create/update/softDelete/hardDelete/
  restore` (+ `encodeRow`, the inverse of `mapRow`; ids = `crypto.randomUUID()`,
  timestamps via `Clock`); `write-core.ts` mirrors `read-core.ts`. Tested in
  `server/rpc-write.test.ts` via the typed `RpcTest` client + `sql/database/write.test.ts`.)
- [x] **Validation:** one `Schema` decode shared client+server; failure →
  `ValidationError` envelope (`code: "VALIDATION"` + `{ fields }`). (The handler
  validates `data` against `Schema.Struct(collection.fields)` with `errors: "all"`,
  formatting the `ParseError` via `ParseResult.ArrayFormatter` into a per-field map;
  the vended form runs the **same** schema client-side (`lib/admin.ts validateWrite`)
  before submit. No `effect-form` / `MutationService` — see status note above.)
- [x] **CSRF** (HMAC double-submit) + **session enforcement** as
  `Rpc.Middleware` on every mutation procedure (reads keep session-only).
  (`server/csrf.ts`: `CsrfMiddleware` attached per write-`Rpc` via `Rpc.middleware`,
  enforcing a `nonce.HMAC-SHA256(secret, nonce)` token — Web Crypto, workerd+Bun —
  where the `x-voila-csrf` header must equal the `voila_csrf` cookie. `secret`
  threads `defineContent → Content → makeHandler → mount`; the playground mints at
  `GET /admin/api/csrf`. Session enforcement is the existing group-level
  `SessionMiddleware`. Tested: `server/csrf.test.ts` + a real-HTTP `server/mount-write.test.ts`
  — missing token → `Forbidden`, valid token → success.)
- [ ] **`@voila/content-sql/pg`:** Postgres `Layer`; migration parity; `voila migrate
  apply --target postgres --db <url>`.
  > **From M1 (read path):** the dialect-neutral pieces are already done and unit-tested
  > — the `Database` read layer (`mapRow`/`normalize`) coerces Postgres-shaped raw
  > values (Date→epoch-ms, real boolean, `bigint`→number, parsed JSONB) into the same
  > canonical document SQLite produces (`sql/database/maprow.test.ts`, both dialect
  > shapes asserted), and the per-collection schemas decode that canonical form. What
  > remains for M2 is genuinely the **live** path: the pg client `Layer` (driver +
  > connection) and an actual against-real-Postgres integration test. M1 verified the
  > read-mapping *logic* for pg-shaped rows but did **not** run a live Postgres — that
  > is correctly M2 scope, not something claimed done in M1.

### Head (registry items)
- [x] Field widgets: `string`, `number`, `boolean`, `date`/`datetime`,
  `select`, `slug`. (Vended as one `FieldInput` (`components/admin/field-input.tsx`)
  that switches on the field's `@voila/content` metadata (`VoilaField` annotation →
  `kind`/`widget`/`options`) — the write-side inverse of `field-value.tsx` — over a
  small shadcn primitive set (`ui/{label,checkbox,select,textarea}`). **Not** an
  `effect-form` field-atom-per-widget registry: plain controlled inputs holding the
  encoded wire value, which is simpler and matches the M1 read UI's style.)
- [x] `collection-form` + widget host (label/description/error/aria); field- and
  form-level errors + retry. **Validation schema = the same `effect/Schema` the
  server runs** (`validateWrite` → `Schema.Struct(collection.fields)`).
  (`components/admin/collection-form.tsx`; submits via a CSRF-armed
  `createAsyncClient` (`lib/voila-write.ts` + `lib/csrf.ts`). Routed at
  `/admin/$collection/new` + `/admin/$collection/$id/edit`, with New/Edit/Delete
  actions on the list + detail. `FormReact.make`/`effect-form` not used — see status
  note.)
- [ ] Optimistic updates via **`Reactivity` (effect-atom) invalidation** +
  toasts; last-write-wins on `updatedAt`. (Writes currently land via a plain refetch
  / navigation, not optimistic `Reactivity` invalidation — still open.)

### Lifecycle
- [ ] Collection hooks (`before/after` × create/update/delete) via `HookService`.
- [ ] Audit log (`_voila_audit`); Trash page (restore + purge).

### Testing bar (M2)
- [ ] **Unit:** each widget renders/accepts input/surfaces errors. (The `FieldInput`
  isn't unit-tested yet; its behaviour is exercised indirectly by the form.)
- [ ] **Unit:** hook ordering + short-circuit (pure `Effect` specs). (No hooks yet.)
- [ ] **Unit (form parity):** property test that the same `Schema` produces the same
  error shape client + server. (The form *does* run the same `Schema.Struct(fields)`
  as `write-core`, but the dedicated property test isn't written.)
- [~] **Integration:** CRUD against SQLite **and** Postgres (CI matrix). (SQLite **done**
  — `server/rpc-write.test.ts` (typed `RpcTest`) + `server/mount-write.test.ts` (real
  HTTP + CSRF) + `sql/database/write.test.ts`. Postgres awaits the live pg `Layer`.)
- [ ] **Integration:** optimistic rollback on server error (Reactivity-driven).
- [~] **Integration:** cross-field/uniqueness validator via the typed client.
  (Unique-violation → `ConflictError` is covered in `rpc-write.test.ts`; an
  `effect-form` `.refineEffect` cross-field check is not — no `effect-form`.)
- [ ] **E2E:** create → edit → delete → restore → purge. (The write UI builds +
  typechecks and the client bundle is verified server-code-free; the Playwright
  write-flow E2E — extending `login-and-browse` — is the remaining manual-verify gap.)
- [ ] **Property (`fast-check`):** roundtrip arbitrary valid docs.
- [x] Coverage gate: engine core ≥ 80%. (`test:cov:gates` bumped 70→80; engine at ~94%.)

**Exit:** full CRUD on `posts` from the vended admin with validation +
optimistic UI; Postgres matrix green. **Partially met** — CRUD + validation +
CSRF work end-to-end on SQLite/D1 from the vended admin; optimistic UI and the
Postgres matrix remain.

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
