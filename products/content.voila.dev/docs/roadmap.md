# Roadmap

Milestone-based, ~1 FTE. Slip the date, never the exit criterion. Each phase
ships with tests green (`bun test`) before it's marked done.

> **Context:** the engine was rebuilt in plain TypeScript (Effect removed). The
> schema/fields core is done; everything below the line is being rebuilt or
> built fresh on that pure-TS foundation. See [tech decisions](./tech-decisions.md).

## ✅ Phase 0 — Schema & fields engine (`@voila/content`)

- [x] `defineConfig` / `defineCollection` / `defineSingleton`
- [x] Field constructors (one file each): `string`, `number`, `boolean`, `id`,
      `slug`, `secret`, `password`, `color`, `code`, `markdown`, `enum`,
      `select`, `multiSelect`, `date`, `datetime`, `time`, `duration`,
      `position`, `json`, `array`, `object`, `relation`, `polymorphic`, `media`,
      `richText`
- [x] Standard Schema validators (zero-dep `std/` kit); `Field<T, Meta>` carries
      typed metadata
- [x] Localized fields + locale narrowing via `defineConfig`
- [x] `InferDoc` / `InferSingleton` (no codegen)
- [x] Strict typing pass: cast-free field constructors

**Exit:** pure-TS, zero Effect refs, full typecheck + tests green. ✅

## Phase 1 — CLI & SQL (`@voila/content-cli`)

- [x] DDL generator from field metadata (SQLite + Postgres dialects) — reads
      `field.meta`, no schema-AST archaeology
- [x] Migrator: `voila_migrations` journal + `migrate generate` / `migrate apply`
- [x] Apply targets: `bun:sqlite` (local), D1 (wrangler). Postgres DDL renders;
      live `migrate apply` to Postgres awaits the Phase 2 pg client
- [x] `voila` binary on `node:util` `parseArgs` (`migrate generate`/`apply`)
- [ ] `seed` / `doctor` subcommands

Pure TypeScript, zero Effect. The runtime `Database` CRUD service + SQLite/D1
driver layers were deferred to Phase 2 (now done — see below), where their driver
seam was co-designed with the server/client that consumes them.

**Exit:** `voila migrate generate && apply` builds a real schema from a config. ✅

## Phase 2 — Server & typed client (`@voila/content/server`, `/client`)

- [x] Runtime `Database` (`@voila/content/server`): CRUD + keyset pagination
      (soft-delete scoped, unique-conflict classification) over a pure-TS
      `SqlDriver` seam, with SQLite (`bun:sqlite`) and D1 adapters. The
      schema-descriptor core (`deriveSchema`) moved to `@voila/content/sql` so
      the Database and the CLI's DDL renderer share one column-mapping source.
- [x] REST read endpoints (`@voila/content/server`): list (cursor pagination),
      find-by-id, find-by-unique-field over the runtime `Database`, with a typed
      error envelope (`{ data, nextCursor }` / `{ error: { code, … } }`) and a
      `createRestHandler` dispatcher.
- [x] Write path (`@voila/content/server`): create / update / soft-delete /
      restore over the runtime `Database`, with field-by-field Standard Schema
      validation (422 `VALIDATION` envelope carrying `{ path, message }` issues)
      and unique-violation → 409 `CONFLICT`. Routed through the same
      `createRestHandler` dispatcher (`POST`/`PATCH`/`DELETE` + `POST …/restore`).
- [x] Typed client inferred from config (`@voila/content/client`): `makeClient(config,
      { baseUrl })` → one accessor per collection with `list` / `find` / `findBy` /
      `create` / `update` / `delete` / `restore`, argument + result types resolved from
      the fields via `InferDoc` (no codegen). Thin `fetch` over the REST routes; error
      envelopes become a typed `ContentClientError` (`err.failure.code`).
- [x] Auth seam + request guard (`@voila/content/server` `auth/`): a pluggable
      `Authenticator` (`Request → Principal | null`) and `AccessControl` RBAC hook,
      run by `createRestHandler` before any handler — auth → CSRF → RBAC, with
      typed `UNAUTHORIZED` (401) / `FORBIDDEN` (403) envelopes. Mirrors the
      `SqlDriver` seam: the engine ships the seam, concrete backends plug in.
- [x] CSRF (signed double-submit) on writes; per-collection RBAC hook. Mutating
      routes require a matching, HMAC-signed cookie/header token pair (`CSRF` 403,
      Web Crypto, edge-safe); reads are exempt.
- [x] Better Auth bridge + email magic-link (`@voila/content/better-auth`):
      `makeBetterAuth` returns a concrete `Authenticator` (session cookie →
      `Principal`) over a Better Auth SQL adapter on the `SqlDriver` seam, plus a
      `handler` for the auth routes. Magic-link sign-in over a `Mailer` seam
      (console default + Resend over HTTP; SMTP is node-only, deferred). Better
      Auth is an *optional peer dep* on its own subpath — the core stays light.
      Auth-table DDL ships from `@voila/content/sql`; `voila migrate generate
      --auth` folds it into a migration.

**Exit:** log in → browse → edit a document over HTTP, end to end — the engine
pieces are in place (auth bridge + REST write path + typed client); the wired
admin UI lands in Phase 3.

## ✅ Phase 3 — UI: primitives + blocks (`@voila/ui`, `@voila/content-ui`)

- [x] `@voila/ui` primitives: button, input, select, checkbox/switch, card,
      table parts, dialog/drawer/popover, combobox, datepicker, tabs, toast,
      tooltip, sidebar, badge, command palette
- [x] `@voila/content-ui`: `DataTable` (columns/cells from config), `FieldRenderer`
      + widget registry, `CollectionForm` (inputs + Standard Schema validation),
      `AdminShell` + `AppSidebar` (nav from config), `ListView`, `DetailView`,
      dashboard widgets (`Dashboard` + `StatCard`)
- [x] Tailwind v4 token layer; light/dark; Phosphor icons (`@voila/ui`:
      `styles.css` HSL tokens + `.dark`, `@voila/ui/tailwind` `@theme`,
      `@voila/ui/icons`)

The `@voila/content-ui` blocks are presentational and router-agnostic — the host
fetches with the typed `@voila/content/client` and feeds data + actions in
(`renderLink` / `currentPath` / `onRowClick`), so the same blocks drive any
framework. Wiring them into a running app (loaders, routes) is Phase 4 vending.

**Exit:** a config renders full list + create/edit/detail with no hand-written
columns or form fields. ✅

## Phase 4 — Registry & vending (`@voila/content-registry`)

- [x] Registry manifest + vended source for shell, routes, blocks, fields:
      `@voila/content-registry` ships a typed catalog (`RegistryItem` =
      files + npm `dependencies` + `registryDependencies`) with the real source
      under `src/items/`, and a `resolve()` that turns item names into a
      dependency-first install plan (cycle + version-conflict detection).
- [x] `voila add <item...>` — resolves the dependency graph, copies the real
      files into the app (`--cwd`, skips existing unless `--overwrite`,
      `--dry-run`), and installs the npm deps via the detected package manager
      (`--no-install` to just print them)
- [x] `voila list` — browse the catalog (grouped by type, `--type` filter)
- [x] `voila diff [item...]` — drift between a vended copy and upstream
      (per-file unchanged / modified / missing, with an LCS line diff of the
      changes); defaults to the whole catalog when no item is named
- [ ] `create-voila` template: fresh TanStack Start app, wired, one migration

**Exit:** the afternoon test (see [DX](./dx.md)) passes on a clean install.

## Phase 5 — Full feature set

- [ ] Media: R2/S3 storage, image/video transforms, signed URLs
- [ ] i18n: localized content + admin translation
- [ ] Drafts, versions, scheduled publishing
- [ ] Role-based access (per-collection, per-field)
- [ ] Search (D1 FTS5 / Postgres FTS), audit log, import/export (JSON/CSV)
- [ ] Webhooks, background tasks, cron
- [ ] Live preview (Cloudflare Durable Object channel)
- [ ] MCP server over the config for AI agents

**Exit:** day-one feature parity with serious headless CMSes — config-first.

## Out of scope

- Visual page builder (use blocks + rich text)
- Marketing-site builder (this is a CMS, not Webflow)
- Hosted SaaS tier (run it yourself; pay Cloudflare)

→ [Philosophy](./philosophy.md) · [Developer Experience](./dx.md) · [Tech Decisions](./tech-decisions.md)
