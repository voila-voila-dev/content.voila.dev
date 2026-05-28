# Effect Architecture Canon

> **This is the authoritative reference for the Effect pivot.** Every other
> doc (requirements, per-package docs, roadmap) derives its terminology,
> package names, and design decisions from here. If a doc disagrees with this
> file, this file wins. Decisions locked here:
>
> - **Boundary:** Option **A′** — see [registry-boundary-options.md](./registry-boundary-options.md).
> - **Engine depth:** Full Effect platform.
> - **Validator policy:** `effect/Schema` is the one schema language (reverses the old Standard-Schema/Zod-pluggable policy).

---

## 1. The two-world model

content.voila.dev is split into **two worlds** with a hard contract between them:

| World | What it is | How it ships | Tech |
| --- | --- | --- | --- |
| **The Engine** | Headless CMS brain — schema, resolvers, SQL, HTTP API, auth, storage, tasks | **npm dependencies** (granular packages, semver) | **Effect only.** No React. |
| **The Head** | The admin UI + its mount points | **vended into your repo** by the registry CLI (shadcn-style) | **TanStack Router + React + Effect-on-the-edges** (`effect-atom` state, `effect-form` forms, `effect/Schema` shared validation, **LiveStore** local cache + sync from M3). You own it. |

A consumer **depends on** the Engine and **owns** the Head. The contract
between them is the typed **RPC** client (`@voila/content/client`, built on
`@effect/rpc`) + reactive atoms (`@voila/content/client/atoms`) and the schema
types (`@voila/content-schema`). The Head is allowed to *consume* `effect`,
`effect/Schema`, `@effect/rpc` client, `@effect-atom/atom-react`,
`effect-form`, and `@livestore/*` for state, forms, validation, transport,
and sync — but must **not import any `@voila/content/server` resolver/service
(the RPC handler layer)**. React never leaks into the Engine.

The Head additionally consumes **LiveStore** (`@livestore/client` +
`@livestore/sync-cf`) as the reactive local cache + sync substrate from M3
forward. Server-authoritative validation, RBAC, and auth still run inside the
Engine — LiveStore is the *transport and cache*, not the source of truth.

### Extension model (A′)

You extend the Engine by **providing a different `Layer`** for a published
`Service`, never by editing engine source. Every adapter (DB dialect, storage
backend, auth, queue) is a `Layer`; every resolver is a `Service` whose default
`Layer` you can wrap or replace. Effect is therefore **opt-in**: ignore the
seams and you write only TanStack/React.

---

## 2. Layer cake → package map

The "layer cake" referenced across the docs (L1–L11), and the package that owns
each layer.

| L | Layer | Package | World |
| --- | --- | --- | --- |
| L1 | Schema runtime (fields, validation, inference) | `@voila/content-schema` | Engine |
| L2 | Resolvers (query / mutation / RBAC / hooks) + runtime composition | `@voila/content` | Engine |
| L3 | Database Service + dialects | `@voila/content-sql` (+ `/d1` `/pg` `/sqlite` subpaths) | Engine |
| L3 | Storage Service + backends | `@voila/content-storage` (+ `/r2` `/s3` subpaths) | Engine |
| L4 | HTTP API (definition + handlers) | `@voila/content/server` | Engine |
| L5 | Typed client | `@voila/content/client` | Engine |
| — | Auth Service | `@voila/content-auth` | Engine |
| — | Background tasks / queue | `@voila/content` (+ `/queue/*` optional adapters) | Engine |
| — | MCP server | `@voila/content-mcp` | Engine |
| — | Sync — LiveStore + CF DO event log (M3+) | `@voila/content-sync` (+ `/livestore-cf` `/livestore-local`) | Engine |
| — | i18n — localized fields | `@voila/content` | Engine |
| — | i18n — message sync (`voila i18n`) | `@voila/content-cli` | Tooling |
| — | `voila` CLI (incl. registry commands) | `@voila/content-cli` | Tooling |
| — | Registry manifest + vended source | `@voila/content-registry` | Tooling → Head |
| L6–L11 | Route files, admin shell, tables, forms, widgets, theme | **vended via registry** (authored in `@voila/content-registry`, sourced from `@voila/ui` + `@voila/rich-text-editor`) | Head |

Cross-product UI packages (`packages/` at repo root, not under the product):
`@voila/ui` (design system), `@voila/rich-text-editor` (Plate editor),
`@voila/typescript-config`.

---

## 3. Canonical package list & responsibilities

**Engine — npm dependencies, Effect only:**

| Package | Owns | Key Effect surface |
| --- | --- | --- |
| `@voila/content-schema` | Field constructors as annotated `Schema`s; `InferDoc`; `defineField`; the `Locale` type; collection/singleton schema shapes. Depends only on `effect` — the shared leaf | `effect/Schema`, `Schema.annotations` |
| `@voila/content` | The runtime brain. `defineContent/defineCollection/defineSingleton`; resolver `Service`s (`DocumentService`, `MutationService`, `RbacService`, `HookService`) + default `Layer`s; lifecycle hooks; RBAC predicate compiler; task API (`defineTask` + inline/Cloudflare queue `Layer`s); localized-field support; runtime composition. **Subpaths:** `/server` (the `HttpApi` + handlers, L4), `/client` (typed client, L5), `/queue/*` (optional heavy adapters) | `Effect`, `Layer`, `Context.Tag`, `ManagedRuntime`, `@effect/platform` `HttpApi*` |
| `@voila/content-sql` | DB `Service` (`Database`), schema→table derivation, migrations, query compiler. **Dialect subpaths** `/d1`, `/pg`, `/sqlite` each provide a `SqlClient` `Layer`; drivers are optional peer deps (install only what you use) | `@effect/sql` `SqlClient`, `Migrator`; `@effect/sql-d1` / `-pg` / `-sqlite-bun` |
| `@voila/content-storage` | Storage `Service` + `/r2` `/s3` `Layer`s, presign, transforms | `@effect/platform` |
| `@voila/content-auth` | Auth `Service` (session, identity, RBAC subject); Better Auth bridged as a `Layer` (isolatable so swapping to Clerk/Auth.js = a different `Layer`) | `Effect`, `Layer` |
| `@voila/content-mcp` | MCP server over the `HttpApi`/schema; HTTP + stdio transports | `@effect/platform`, (`@effect/ai`) |
| `@voila/content-sync` | `Sync` Service; LiveStore + Cloudflare DO transport (M3 default); event-schema derivation; REST↔LiveStore convergence. **Subpaths:** `/livestore-cf` (DO + D1), `/livestore-local` (in-memory tests) | `Effect`, `Layer`, `Context.Tag`, `@livestore/client`, `@livestore/sync-cf` |

**Tooling:**

| Package | Owns |
| --- | --- |
| `@voila/content-cli` | The `voila` binary on `@effect/cli`: `migrate`, `seed`, `add`/`diff`/`list` (registry), `i18n` (Paraglide/Inlang message sync), `doctor`, `mcp`. |
| `@voila/content-registry` | The `registry.json` manifest and the **vended source** for L6–L11 (route files, admin shell, tables, forms, widgets, theme). |

**Cross-product UI (repo-root `packages/`):**

| Package | Owns |
| --- | --- |
| `@voila/ui` | shadcn-on-Base-UI primitives, Tailwind v4 token layer, Phosphor icons. Source-of-truth for registry UI items. |
| `@voila/rich-text-editor` | Plate/Slate editor behavior (`/`) + default node components (`/nodes`). |
| `@voila/typescript-config` | Shared tsconfig bases. |

> **Migration from the current tree:** `@voila/content-database` (Drizzle) →
> `@voila/content-sql` (+ dialect subpaths on `@effect/sql`). `@voila/content-schema`,
> `@voila/content`, `@voila/content-auth`, `@voila/content-cli` keep their names but
> are **rewritten** for Effect. The old `@voila/content-client` package folds into
> `@voila/content/client`; the React/admin half of `@voila/content` is salvaged into
> `@voila/content-registry` (vended). **No standalone `queue` or `i18n` packages** —
> tasks fold into `@voila/content`; i18n splits into localized-field support
> (`@voila/content`) + message sync (`@voila/content-cli`).

---

## 4. The schema model (`@voila/content-schema`)

A field **is** an `effect/Schema` carrying voila metadata in its annotations.
One object is simultaneously the type, the validator (decode/encode), the DB
column spec, and the UI hint.

```ts
// conceptual shape — a field constructor returns an annotated Schema
export const string = (opts?: StringOpts) =>
  Schema.String.pipe(
    opts?.min !== undefined ? Schema.minLength(opts.min) : identity,
    Schema.annotations({
      // voila-namespaced annotations carry DB + UI metadata
      [VoilaField]: { kind: "string", unique: opts?.unique, widget: "string", ... },
    }),
  )
```

- **Validation** = `Schema.decodeUnknown` (parse) / `Schema.encode` (persist).
  Server and client run the *same* schema — the single source of truth.
- **Inference** = `Schema.Schema.Type<typeof field>`; `InferDoc<typeof config,
  "posts">` walks the collection's struct.
- **Standard Schema:** `effect/Schema` is itself Standard-Schema-compliant via
  `Schema.standardSchemaV1`, so the Head/forms still speak a standard contract —
  but the Engine speaks `effect/Schema` natively and ships no other adapter.
- **No Zod, no pluggable validator library.** This reverses the prior policy.

---

## 5. The data model (`@voila/content-sql` + dialects)

- Built on **`@effect/sql`**: the `SqlClient` `Tag` is the seam; dialect packages
  provide its `Layer` (`@effect/sql-d1`, `@effect/sql-pg`, `@effect/sql-sqlite-bun`).
- `@voila/content-sql` exposes a `Database` `Service` with the CRUD/query primitives the
  resolvers call; swapping DB = `Layer.provide(D1Live | PgLive | SqliteLive)`.
- **Migrations** via `@effect/sql/Migrator` + a schema→DDL generator that reads
  field annotations. `voila migrate generate|apply` drives it.
- **Drizzle is removed.** All golden-file migration tests port to the new generator.

### Server as event materializer (M3+)

From M3, LiveStore events synced from clients land in a Cloudflare Durable
Object (`@livestore/sync-cf`) that calls into `MutationService.validateWrite`
before appending to the D1 event log. Decode failure → event rejected, client
sees a typed `ValidationError` envelope identical to the REST 422.
`RbacService` predicates run on the event author's session. **The event log is
the system of record for content** from M3 forward; the relational tables in
`@voila/content-sql` are projected from events for query / MCP / public-API use.

---

## 6. The API model (`@voila/content/server` + `@voila/content/client`)

- The Engine surface is **one `RpcGroup` definition** per collection
  (`@effect/rpc`): `Rpc.make` per operation, request/response/error
  `Schema`s reused from `@voila/content-schema`. Collected into a single
  `voilaRpc` `RpcGroup`.
- From that single definition we derive **four artifacts**:
  1. **Server handler `Layer`** via `RpcServer.toLayer`.
  2. **Typed RPC client** via `RpcClient.make` → `@voila/content/client`.
  3. **`HttpApi`** (for OpenAPI export + MCP HTTP transport) — attempted as a
     Rpc→Http derivation in M1; if the derivation does not cover the error
     envelope, cursor pagination, or middleware semantics, fall back to a
     thin parallel `HttpApi` definition that reuses the same `Schema`s and
     calls the same handler `Effect`s. Decision recorded as an ADR.
  4. **OpenAPI** via `OpenApi.fromApi` over the derived/parallel HttpApi
     (feeds docs + MCP HTTP transport).
- **There is no public REST API.** External consumers use the RPC client (or
  LiveStore, for content). `HttpApi` exists only as a derivation target for
  OpenAPI export and the MCP HTTP transport.
- **Error envelope** is unchanged in shape — `{ data, nextCursor? }` /
  `{ error: { code, ...fields } }` — produced by mapping typed Effect errors
  to the envelope. CSRF (HMAC double-submit) and session enforcement become
  `Rpc.Middleware`s.

### Transport matrix

| Transport | Audience | Owner | Source of truth |
| --- | --- | --- | --- |
| **`@effect/rpc`** | Admin Head ↔ Engine; external programmatic consumers; non-synced ops | `@voila/content/server` (handler `Layer`), `@voila/content/client` (typed client) | M1+ |
| **LiveStore** | Admin Head content reads/writes — reactive cache + sync | `@voila/content-sync` | M3+ |
| **`HttpApi`** (derived) | MCP HTTP transport, OpenAPI export, `--eject-server` | `@voila/content/server` (internal) | Derived from RpcGroup |

All three surfaces share **one `effect/Schema` per operation** and **one
`MutationService.validateWrite`**. A REST PATCH (when the derived HttpApi is
hit), an RPC mutation, and a LiveStore commit produce **identical event-log
entries** and converge on a single projection.

### Reactive client state and forms

- **`effect-atom`** (`@effect-atom/atom-react`) is the admin Head's reactive
  state primitive. The atom factory ships at `@voila/content/client/atoms` and
  wraps the RPC client; mutations invalidate via `Reactivity`. `Atom.keepAlive`
  is required on list/detail atoms.
- **`@effect-atom/atom-livestore`** is the official bridge from
  `@effect-atom/atom-react` to a LiveStore store. From M3 the
  `/client/atoms` factory dispatches its list/detail/mutation atoms through
  `@effect-atom/atom-livestore` against the project's LiveStore instance — no
  hand-rolled bridge. Pre-M3 the same factory dispatches against the RPC
  client.
- **`effect-form`** is the form primitive. The form's validation schema is the
  **same `effect/Schema`** used by the RPC mutation procedure and by
  `MutationService.validateWrite`. One schema, four call sites (server decode,
  RPC client decode, client form validation, client error rendering).
(Reactive state, forms, LiveStore — covered above in the transport matrix
and bullets.)

---

## 7. The registry model (`@voila/content-registry` + `voila add`)

- Replaces the **virtual-route vite plugin**. Routes are now **real files** the
  CLI copies into the consumer's `app/`.
- `registry.json` lists **items** (`admin-shell`, `posts-table`, `field/string`,
  `field/rich-text`, `theme`, …), each with: files to copy, npm deps to install,
  and registry-internal deps (an item can require another item).
- `voila add <item>` resolves deps, copies source, rewrites import aliases.
  `voila diff` shows drift between vended copy and upstream; `voila list` shows
  the catalog.
- The **L6 mount file is thin** — it imports the engine handler and mounts it, so
  the user owns the mount point (path, middleware) without owning handler logic:

  ```ts
  // app/server/voila.ts — VENDED, ~3 lines you own
  import { makeHandler } from "@voila/content/server"
  import config from "~/content.config"
  export const voilaHandler = makeHandler(config) // add middleware here
  ```

- **`--eject-server`** (power-user flag) additionally vends the `HttpApi`
  definition + handlers for teams that want to own them (the residual Option B
  case). Not the default.

---

## 8. Runtime composition (`@voila/content`)

The umbrella package wires the default `Layer` graph so the happy path is one
import, while power users compose granular packages themselves.

```ts
// content.config.ts
import { defineContent } from "@voila/content"
import { D1Live } from "@voila/content-sql/d1"
import { R2Live } from "@voila/content-storage"

export default defineContent({
  branding: { name: "Acme CMS" },
  collections: [posts, authors],
  database: D1Live({ binding: "DATABASE" }),  // a Layer
  storage:  R2Live({ bucket: "media" }),       // a Layer
})
// internally → Layer.mergeAll(SchemaLive, CoreLive, HttpLive, database, storage, ...)
//            → ManagedRuntime.make(...) consumed by the vended mount file
```

Power-user override (the A′ point) — swap or wrap any `Service` `Layer`:

```ts
defineContent({
  ...,
  database: TursoLive({ url }),                       // different dialect Layer
  layers: [Layer.effect(MutationService, auditedMutations)], // wrap a resolver
})
```

---

## 9. Naming & conventions (for all docs)

- Package names exactly as in §3. Never write `@voila/content-schema` (old) —
  it is `@voila/content-schema`.
- "Engine" / "Head" / "vended" / "registry item" / "`Layer`" / "`Service`" are
  the canonical terms. Avoid "plugin" for the Head (it's vended code, not a plugin).
- `effect/Schema` (not "@effect/schema" — Schema is in the `effect` core package
  since 3.10) and not "Zod".
- Milestones reference the **new** roadmap ([roadmap-effect.md](./roadmap-effect.md)),
  not `requirements/12-deprecated-roadmap.md` (superseded).
- Keep the existing doc voice: terse, opinionated, example-first, `Continue →`
  footer links preserved.
- **Transport primitive (admin Head):** `@effect/rpc` `RpcClient` derived
  from `voilaRpc`. Vended code imports the client from
  `@voila/content/client`; **no fetch/REST calls in vended admin code from M1
  forward.**
- **Head state primitives:** `Atom.make` / `useAtomValue` / `useAtomSet`
  (`@effect-atom/atom-react`). Never hand-roll `useEffect`+RPC calls; never
  import TanStack Query in vended items from M1 forward.
- **LiveStore↔atom bridge:** **`@effect-atom/atom-livestore`** (official
  Effect ecosystem package — `tim-smart/effect-atom`'s `atom-livestore`
  subpackage). From M3 the `/client/atoms` factory uses this package to
  derive atoms from LiveStore reactive queries; do **not** roll a custom
  bridge.
- **Form primitive:** `FormReact.make` (`effect-form`). Replaces TanStack Form.
  TanStack Router still drives navigation; TanStack Table still drives the
  data grid (effect-atom feeds it rows).
- **Sync primitive (M3+):** `@livestore/client` + `@livestore/sync-cf`. The
  vended `lib/livestore.ts` wires the project schema + `makeCfSync({ url:
  "/admin/api/sync" })`.

---

## 10. Local-first sync (LiveStore) — M3 default

LiveStore is the M3 default Head data layer. Adapter packages:

- `@livestore/sync-cf` — Durable Object + D1 event log transport.
- `@livestore/adapter-web` — browser OPFS + WASM SQLite + Web Worker persistence.

**Auth / CSRF.** The DO sync endpoint requires a Better Auth session cookie on
connect (HMAC double-submit token verified on WebSocket upgrade).
Unauthenticated sockets close with 4401.

**Validation seam.** The DO's `onPush` calls
`MutationService.validateWrite(event)` before appending to the log. The
`Schema` is the same one used by the RPC mutation procedure and the derived
HttpApi — single source of truth preserved.

**Convergence.** Three write paths converge on a single event log + single
projection:
1. RPC mutation procedure (admin Head, external programmatic clients) →
   `validateWrite` → `Sync.append`.
2. Derived HttpApi REST handler (MCP HTTP transport, `--eject-server`) → same
   `validateWrite` → same `Sync.append`.
3. LiveStore `commit(event)` (admin Head via `@effect-atom/atom-livestore`)
   → DO materializer → `validateWrite` → `Sync.append`.

**Atom bridge.** The admin Head reads through `@effect-atom/atom-livestore` —
the official `effect-atom` ⇄ LiveStore package. The `/client/atoms` factory
swaps from RPC-backed atoms (M1–M2) to `atom-livestore`-backed atoms (M3+)
with identical atom shapes, so vended components don't change.

**Status:** LiveStore is beta v0.3.x. Pinned version + adapter test suite in
M3; minor-version upgrades treated as breaking until LiveStore reaches 1.0.

**Open question carried into M6.** MCP (M6) currently writes via REST. With
M3 LiveStore-default, MCP either (a) keeps using REST → both paths must
converge to the same event log (extra invariant to test), or (b) becomes a
LiveStore peer node. Resolve in M6 design.
