# @voila/content

> The Engine runtime: resolver `Service`s, runtime composition, HTTP API, typed client, background tasks, and localized-field support — the flagship package. **World:** Engine. **Layer:** L2, L4, L5. **Status:** M0 (skeletons) → M1–M2 (resolvers + write path) → M3 (HTTP/client) → M5 (tasks).

## Responsibility

The umbrella package owns three concerns in one version-locked unit:

1. **Runtime core** — `defineContent/defineCollection/defineSingleton`; resolver `Service`s (`DocumentService`, `MutationService`, `RbacService`, `HookService`) + default `Layer`s; lifecycle hooks; RBAC predicate compiler; localized-field storage-shape handling (`localized: true`).
2. **RPC API** (via `/server` subpath) — the `voilaRpc` `RpcGroup` definition (`@effect/rpc`), `RpcServer.toLayer` handlers, CSRF + session `Rpc.Middleware`s, error→envelope mapping, **derived `HttpApi`** (used only for OpenAPI export + MCP HTTP transport, not exposed as a public REST surface).
3. **Typed RPC client** (via `/client` subpath) — `RpcClient.make` over `voilaRpc`; Effect-native surface (`Atom.make(client.posts.list(...))`-friendly), thin async/await sugar for non-atom call sites; no React in the package.
4. **Background tasks** (via `/queue/*` optional subpaths) — `defineTask` + `Queue` Service with `InlineLive` and `CloudflareQueuesLive` adapters.

Does **not** own: SQL (`@voila/content-sql`), storage (`@voila/content-storage`), auth (`@voila/content-auth`), MCP (`@voila/content-mcp`), CLI (`@voila/content-cli`), or any React.

---

## Subpath exports

| Import | What it contains |
|--------|-----------------|
| `@voila/content` | Core: `defineContent`, `defineCollection`, `defineSingleton`, `Service` tags + `Layer`s, `defineTask`, `Queue`, `InlineLive`, `CloudflareQueuesLive`, re-exports from `@voila/content-schema` |
| `@voila/content/server` | L4: `voilaRpc` (RpcGroup), `makeRpcHandler`, `makeRpcHandlerLayer`, derived `httpApi`, `openApiSpec`, `Rpc.Middleware`s (CSRF + session) |
| `@voila/content/client` | L5: `createClient` → `RpcClient<C>` (Effect-native); thin `asyncClient` for non-atom call sites; `ContentClientError` |
| `@voila/content/client/atoms` | L5: `contentAtoms<C>(opts)` — reactive `effect-atom` bindings. Backend dispatches to the RPC client in M1–M2, to LiveStore via **`@effect-atom/atom-livestore`** in M3+. Identical atom shape across milestones. |
| `@voila/content/queue/cloudflare` | Heavy adapter: `CloudflareQueuesLive` (CF-specific import; keeps `cloudflare:workers` out of the main bundle) |

---

## Core (`@voila/content`)

### Public API

| Export | Kind | Description |
|--------|------|-------------|
| `defineContent(config)` | Function | Accepts `ContentConfig` + optional adapter `Layer`s; returns a `ManagedRuntime` of the full engine |
| `defineCollection(def)` | Function | Produce a `Collection` with a literal-typed slug |
| `defineSingleton(def)` | Function | Produce a `Singleton` with a literal-typed slug |
| `DocumentService` | `Context.Tag` | List / find / count documents; cursor pagination |
| `MutationService` | `Context.Tag` | Create / update (PATCH) / soft-delete / restore; runs `Schema.decodeUnknown` before persisting |
| `RbacService` | `Context.Tag` | RBAC predicate compiler; `can(subject, action, resource)` |
| `HookService` | `Context.Tag` | `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete` lifecycle hooks |
| `DocumentLive` | `Layer` | Default impl of `DocumentService` (depends on `Database`) |
| `MutationLive` | `Layer` | Default impl of `MutationService` (depends on `DocumentService` + `Database`) |
| `RbacLive` | `Layer` | Default permissive/rule-based `RbacService` |
| `HookLive` | `Layer` | Default no-op `HookService`; compose to add hooks |
| `defineTask` | Function | Register a named background task with payload schema + handler |
| `Queue` | `Context.Tag` | `enqueue(task, payload)` / `consume(batch)` |
| `InlineLive` | `Layer` | In-process queue — runs handlers synchronously; for local dev + tests |
| Re-exports from `@voila/content-schema` | — | `string`, `number`, `boolean`, `date`, `datetime`, `json`, `slug`, `select`, `defineField`, `InferDoc`, `Locale` |

### Localized fields

Fields declared `localized: true` store their value as a `Record<Locale, T>` in the DB column. The field schema is automatically wrapped: `Schema.Record({ key: Locale, value: baseField })`. No standalone i18n package — this is built into the core resolver layer. Message sync (`voila i18n pull|push`) is a CLI concern in `@voila/content-cli`.

### Usage

```ts
// content.config.ts — the one-import happy path
import { defineContent, defineCollection, string, boolean, slug } from "@voila/content"
import { D1Live } from "@voila/content-sql/d1"
import { R2Live } from "@voila/content-storage"

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title:     string({ min: 1, required: true }),
    body:      string({ localized: true }),          // stored as { en: "…", fr: "…" }
    published: boolean({ default: false }),
    postSlug:  slug({ unique: true, derivedFrom: "title" }),
  },
})

export default defineContent({
  branding: { name: "Acme CMS" },
  collections: [posts],
  database: D1Live({ binding: env.DATABASE }),   // Layer — swappable
  storage:  R2Live({ bucket: "media" }),          // Layer — swappable
})
// → Layer.mergeAll(SchemaLive, CoreLive, HttpLive, database, storage, …)
// → ManagedRuntime consumed by the vended app/server/voila.ts
```

### Extension points (A′)

```ts
import { defineContent, MutationService, MutationLive } from "@voila/content"
import { Layer, Effect } from "effect"

const AuditedMutations = Layer.effect(
  MutationService,
  Effect.gen(function* () {
    const base  = yield* MutationService
    const audit = yield* AuditService
    return {
      ...base,
      create: (col, data) =>
        base.create(col, data).pipe(Effect.tap((doc) => audit.log("create", col, doc.id))),
    }
  }),
).pipe(Layer.provide(MutationLive))

export default defineContent({
  collections: [posts],
  database: TursoLive({ url: process.env.TURSO_URL }),
  layers: [AuditedMutations],  // override a resolver without touching source
})
```

---

## RPC API (`@voila/content/server`)

**Layer:** L4. **Status:** M1 (reads) → M2 (writes).

One **`RpcGroup` definition** (`voilaRpc`, built on `@effect/rpc`). Derives:
the server handler `Layer`, the typed RPC client, **and** a derived `HttpApi`
for OpenAPI export + MCP HTTP transport. There is no public REST API — the
HttpApi exists only as a derivation target.

### Public API

```ts
// The RpcGroup definition — import to derive client or extend with custom procedures
export declare const voilaRpc: Rpc.RpcGroup<...>

// Build a live RPC handler Layer from a content config
export declare const makeRpcHandlerLayer: (config: ContentConfig) => Layer.Layer<RpcServer.HttpRouter, ...>

// Convenience: Fetch-compatible RPC handler for the vended mount file
export declare const makeRpcHandler: (config: ContentConfig) => (request: Request) => Promise<Response>

// Derived HttpApi (OpenAPI + MCP HTTP transport only — not exposed as public REST)
export declare const httpApi: HttpApi.HttpApi<...>

// OpenAPI spec
export declare const openApiSpec: Effect.Effect<unknown, never, HttpApi.HttpApi<...>>
```

**Middleware (`Rpc.Middleware`):**

- `CsrfMiddleware` — verifies the HMAC-signed double-submit token
  (`voila_csrf` cookie / `x-voila-csrf` header) on every mutation procedure.
- `SessionMiddleware` — requires a valid session on every procedure (read or
  write); yields the session as a typed service available inside handlers.

**Procedure layout (`voilaRpc`):**

```
posts.list      ({ limit?, cursor?, orderBy? })       Stream / paginated
posts.find      ({ id })                              one
posts.findOne   ({ field, value })                    one
posts.create    (CreateInput)                         one + emits event
posts.update    ({ id, patch: PatchInput })           one + emits event
posts.delete    ({ id, hard? })                       void + emits event
posts.restore   ({ id })                              one + emits event
__system.csrf                                          { token }
__system.health                                        { ok: true }
```

**Error envelope:** `{ data, nextCursor? }` on success; `{ error: { code, ...fields } }` on failure — produced by mapping typed Effect errors (`Rpc.Error` + domain errors) to the envelope shape. The same envelope is emitted by the derived HttpApi handler.

**`Rpc → HttpApi` derivation:** attempted as a first-class derivation in M1.
If derivation does not cover the error envelope, cursor pagination, or
middleware semantics, fall back to a thin parallel `HttpApi` definition that
reuses the same `Schema`s and calls the same handler `Effect`s — recorded as
an ADR in M1.

### Usage

```ts
// app/server/voila.ts — VENDED, ~3 lines you own
import { makeRpcHandler } from "@voila/content/server"
import config from "~/content.config"

export const voilaHandler = makeRpcHandler(config)
// Mounted at /admin/api/rpc by the vended route file.
// Optionally wrap with extra middleware:
// export const voilaHandler = (req) => myRateLimiter(req) ?? makeRpcHandler(config)(req)
```

Power user — add procedures to the same `RpcGroup`:

```ts
import { voilaRpc } from "@voila/content/server"
import { Rpc, RpcGroup } from "@effect/rpc"
import { Schema } from "effect"

const webhooksGroup = RpcGroup.make(
  Rpc.make("webhooks.list", { success: Schema.Array(Webhook) }),
)

const extendedRpc = voilaRpc.merge(webhooksGroup)
```

### Extension points (A′)

- `voilaRpc.merge(myGroup)` — custom groups are reflected in the derived
  client, the derived HttpApi, and the OpenAPI spec automatically.
- Replace `SessionMiddleware` by providing a different `Auth` `Layer` (see
  `@voila/content-auth`).
- `--eject-server` flag on `voila add` vends the full `RpcGroup` definition +
  handler wiring for teams that need to own them. Not the default.

---

## Typed Client (`@voila/content/client`)

**Layer:** L5. **Status:** M1 target (co-ships with `/server`).

Derived from `voilaRpc` via `RpcClient.make`; never hand-written. The default
surface is Effect-native (each procedure returns an `Effect` / `Stream`)
because it composes directly with `effect-atom` and `effect/Schema`. A thin
`asyncClient` wrapper is also exported for non-atom call sites that want
async/await.

### Public API

```ts
export declare const createClient: <C extends AnyContent>(
  options: CreateClientOptions,
) => RpcClient<C>

export declare const createAsyncClient: <C extends AnyContent>(
  options: CreateClientOptions,
) => AsyncContentClient<C>

export interface CreateClientOptions {
  baseUrl: string           // e.g. "/admin/api/rpc"
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
}

// RpcClient<C> — Effect-native typed namespace
// client.posts.list({ limit: 20 })       → Effect<{ data: Post[]; nextCursor: string | null }, ContentClientError>
// client.posts.find({ id })              → Effect<Post, ContentClientError>
// client.posts.create(input)             → Effect<Post, ContentClientError>
// client.posts.update({ id, patch })     → Effect<Post, ContentClientError>
// client.posts.delete({ id })            → Effect<void, ContentClientError>

// AsyncContentClient<C> — async/await sugar (rare; effect-atom is the default consumer)
// asyncClient.posts.list({ limit: 20 })  → Promise<{ data: Post[]; nextCursor: string | null }>
```

Procedure errors decode the envelope and surface as typed
`ContentClientError` instances carrying the `code` discriminator.

### Usage

```ts
// Effect-native — composes inside an atom
import { Atom } from "@effect-atom/atom-react"
import { createClient } from "@voila/content/client"
import type content from "~/content.config"

const client = createClient<typeof content>({ baseUrl: "/admin/api/rpc" })
const postsAtom = Atom.make(client.posts.list({ limit: 20 }))
```

SSR (forward session cookie):

```ts
const client = createClient<typeof content>({
  baseUrl: "/admin/api/rpc",
  headers: { cookie: request.headers.get("cookie") ?? "" },
})
```

---

## Reactive bindings (`@voila/content/client/atoms`)

**Layer:** L5. **Status:** M1 (REST-backed) → M3 (LiveStore-backed, same shape).

A second entry point ships **`effect-atom`** factories derived from the typed
client. Vended Head code prefers these over raw `client.posts.list(...)` so
list/detail views auto-invalidate on mutations and survive milestone backend
swaps without code changes.

### Public API

```ts
export declare const contentAtoms: <C extends AnyContent>(
  options: CreateClientOptions,
) => ContentAtoms<C>

// ContentAtoms<C> mirrors ContentClient<C> but each method returns an
// Atom<Result<...>> (reads) or an Atom.Writable (mutations).
// atoms.posts.list({ limit: 20 })   → Atom<Result<{ data; nextCursor }, ContentClientError>>
// atoms.posts.find("id")            → Atom<Result<Post, ContentClientError>>
// atoms.posts.create                → Atom.Writable<Post, CreateInput<Post>>
// atoms.posts.update                → Atom.Writable<Post, [id: string, patch: PatchInput<Post>]>
```

Mutation atoms invalidate dependent read atoms via `Reactivity` from
`@effect-atom/atom-react`. Atoms used in route components must wrap with
`Atom.keepAlive` to survive remount (effect-atom default resets unused atoms).

### Usage

```ts
// app/components/posts-list.tsx — vended; effect-atom for state
import { Atom, useAtomValue } from "@effect-atom/atom-react"
import { contentAtoms } from "@voila/content/client/atoms"
import content from "~/content.config"

const atoms = contentAtoms<typeof content>({ baseUrl: "/admin/api" })
const postsAtom = Atom.keepAlive(atoms.posts.list({ limit: 20 }))

export function PostsList() {
  const posts = useAtomValue(postsAtom)
  if (posts._tag !== "Success") return <Skeleton />
  return <DataTable rows={posts.value.data} />
}
```

### Backend dispatch

| Milestone | Read backend | Write backend |
| --- | --- | --- |
| M1–M2 | `@voila/content/client` (`RpcClient`, `@effect/rpc`) | `@voila/content/client` (RPC mutation procedure) |
| M3+ | `@effect-atom/atom-livestore` over the project's LiveStore (reactive SQL view) | LiveStore `commit(event)` via `@effect-atom/atom-livestore` → DO materializer → `MutationService.validateWrite` → D1 event log |

Vended component code never touches the backend choice — it imports
`contentAtoms` and consumes atoms. The atom shapes are identical across
milestones so M3 swaps the backend without any vended-code changes.

---

## Background Tasks (`@voila/content` + `/queue/*` subpaths)

**Status:** M5 target.

### Public API

```ts
// Define a named task with payload schema + handler
export declare const defineTask: <P>(opts: {
  name: string
  schema: Schema.Schema<P>
  handler: (payload: P) => Effect.Effect<void, never, TaskDeps>
  retry?: { attempts: number; backoff?: "exponential" | "linear" }
  dlq?: string   // CF Queue name for dead-letter
}) => TaskDefinition<P>

// Queue Service tag
export declare class Queue extends Context.Tag("@voila/content/Queue")<
  Queue,
  {
    enqueue<P>(task: TaskDefinition<P>, payload: P): Effect.Effect<void, QueueError>
    consume(batch: MessageBatch<unknown>): Effect.Effect<void>
  }
>() {}

// In-process Layer — synchronous, no CF binding (local dev + tests)
export declare const InlineLive: (tasks: TaskDefinition<unknown>[]) => Layer.Layer<Queue>
```

`CloudflareQueuesLive` is available from `@voila/content/queue/cloudflare` to keep the `cloudflare:workers` import out of the main bundle for non-CF consumers.

### Usage

```ts
// Define a task (in consumer code or @voila/content resolver)
import { defineTask, Queue } from "@voila/content"
import { Schema, Effect } from "effect"

export const revalidateCache = defineTask({
  name: "revalidate-cache",
  schema: Schema.Struct({ collectionSlug: Schema.String, docId: Schema.String }),
  handler: ({ collectionSlug, docId }) =>
    Effect.logInfo(`revalidating ${collectionSlug}/${docId}`),
  retry: { attempts: 3, backoff: "exponential" },
})

// Wire in content.config.ts
import { CloudflareQueuesLive } from "@voila/content/queue/cloudflare"

export default defineContent({
  collections: [posts],
  database: D1Live({ binding: env.DATABASE }),
  queue: CloudflareQueuesLive({ queue: env.CONTENT_QUEUE, tasks: [revalidateCache] }),
})

// Local dev / tests — swap for inline layer
import { InlineLive } from "@voila/content"
const TestQueue = InlineLive([revalidateCache])
```

### Extension points (A′)

Provide any `Layer.Layer<Queue>` to route to a different backend (BullMQ, Inngest, plain webhook). The engine only depends on the `Queue` tag.

---

## Effect surface

| Primitive | Use |
|-----------|-----|
| `Effect`, `Layer`, `Context.Tag` | Service definitions + composition |
| `ManagedRuntime` | `defineContent` produces a managed runtime |
| `@effect/rpc` `RpcGroup` / `Rpc` | Procedure definition in `/server` (`voilaRpc`) |
| `@effect/rpc` `RpcServer.toLayer` | Server handler derivation in `/server` |
| `@effect/rpc` `RpcClient.make` | Typed client derivation in `/client` |
| `@effect/rpc` `Rpc.Middleware` | CSRF + session enforcement in `/server` |
| `@effect/platform` `HttpApi*` | Derived HttpApi for OpenAPI export + MCP HTTP transport (internal) |
| `OpenApi.fromApi` | OpenAPI spec in `/server` |
| `effect/Schema` | Procedure request/response codecs; task payload schemas; localized field wrapping |
| `Schedule` | Retry/backoff in task layer |
| `@effect-atom/atom-react` | Atom factory in `/client/atoms` (peer dep on the Head) |
| `@effect-atom/atom-react` `Reactivity` | Mutation → query invalidation across atoms (M1–M2) |
| `@effect-atom/atom-livestore` | LiveStore↔atom bridge in `/client/atoms` (M3+) |

## Dependencies

```
@voila/content-schema           # field schemas, InferDoc, Locale
@voila/content-sql              # Database Service
@voila/content-storage          # Storage Service
@voila/content-auth             # Auth Service (session enforcement in /server)
@effect/rpc                     # RpcGroup, RpcServer, RpcClient
@effect/platform                # derived HttpApi (OpenAPI + MCP HTTP transport only)
effect
@effect-atom/atom-react         # peer; required for /client/atoms (Head)
@effect-atom/atom-livestore     # peer; required for /client/atoms LiveStore dispatch (M3+)
@livestore/client               # peer; underlies the LiveStore atom bridge (M3+)
```

## Testing

- **Core:** each `Service` resolved against test-double `Layer`s (in-memory `Database`) via `Layer.toRuntime`; mutation validation asserts typed `ValidationError`; hook ordering verified.
- **RPC:** procedure logic tested in-process via `RpcServer.toLayer` against an in-memory transport; integration test mounts the RPC handler in a real `HttpServer`; asserts envelope shape, CSRF rejection, 401 on missing session.
- **Derived HttpApi:** type test that the derivation produces the same envelope shape per procedure as the RPC client; runtime test that an OpenAPI export round-trips.
- **Client:** `createClient` against a test RPC server; asserts typed responses and `ContentClientError` on procedure failure.
- **Atoms:** `contentAtoms` against a test RPC client (M1) and against `@effect-atom/atom-livestore` over an in-memory LiveStore (M3); asserts identical atom shapes and that `Reactivity` invalidations propagate.
- **Tasks:** `InlineLive` makes task handler tests deterministic without any external service.
- **Wiring:** `defineContent` with minimal config produces a `ManagedRuntime` that resolves without errors using in-memory SQLite.

---

Continue → [content-schema.md](./content-schema.md) · [content-sql.md](./content-sql.md) · [content-storage.md](./content-storage.md) · [content-auth.md](./content-auth.md)
