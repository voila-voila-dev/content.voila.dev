# @voila/content

> The Engine runtime: resolver `Service`s, runtime composition, HTTP API, typed client, background tasks, and localized-field support — the flagship package. **World:** Engine. **Layer:** L2, L4, L5. **Status:** M0 (skeletons) → M1–M2 (resolvers + write path) → M3 (HTTP/client) → M5 (tasks).

## Responsibility

The umbrella package owns three concerns in one version-locked unit:

1. **Runtime core** — `defineContent/defineCollection/defineSingleton`; resolver `Service`s (`DocumentService`, `MutationService`, `RbacService`, `HookService`) + default `Layer`s; lifecycle hooks; RBAC predicate compiler; localized-field storage-shape handling (`localized: true`).
2. **HTTP API** (via `/server` subpath) — the `HttpApi` definition, `HttpApiBuilder` handlers, CSRF + session middleware, error→envelope mapping, OpenAPI.
3. **Typed client** (via `/client` subpath) — derived from the `HttpApi`; async/await surface; no Effect leaks to the Head.
4. **Background tasks** (via `/queue/*` optional subpaths) — `defineTask` + `Queue` Service with `InlineLive` and `CloudflareQueuesLive` adapters.

Does **not** own: SQL (`@voila/content-sql`), storage (`@voila/content-storage`), auth (`@voila/content-auth`), MCP (`@voila/content-mcp`), CLI (`@voila/content-cli`), or any React.

---

## Subpath exports

| Import | What it contains |
|--------|-----------------|
| `@voila/content` | Core: `defineContent`, `defineCollection`, `defineSingleton`, `Service` tags + `Layer`s, `defineTask`, `Queue`, `InlineLive`, `CloudflareQueuesLive`, re-exports from `@voila/content-schema` |
| `@voila/content/server` | L4: `voilaApi`, `makeHandler`, `makeHandlerLayer`, `openApiSpec` |
| `@voila/content/client` | L5: `createClient`, `ContentClient<C>`, `ContentClientError` |
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

## HTTP API (`@voila/content/server`)

**Layer:** L4. **Status:** M3 target.

One `HttpApi` definition; derives server handlers, OpenAPI spec, and the typed client from it.

### Public API

```ts
// The HttpApi definition — import to derive client or add endpoints
export declare const voilaApi: HttpApi.HttpApi<...>

// Build a live handler Layer from a content config
export declare const makeHandlerLayer: (config: ContentConfig) => Layer.Layer<HttpApiBuilder.Router, ...>

// Convenience: Fetch-compatible handler for the vended mount file
export declare const makeHandler: (config: ContentConfig) => (request: Request) => Promise<Response>

// OpenAPI spec (JSON-serialisable) derived from voilaApi
export declare const openApiSpec: Effect.Effect<unknown, never, HttpApi.HttpApi<...>>
```

**Middleware (applied via `HttpApiBuilder`):**

- `CsrfMiddleware` — issues and verifies the HMAC-signed double-submit token (`voila_csrf` cookie / `x-voila-csrf` header).
- `SessionMiddleware` — requires a valid session on all `/admin/api/*` routes; yields the session as a typed `HttpApiMiddleware` service.

**Endpoint layout:**

```
GET    /admin/api/:collection              list
GET    /admin/api/:collection/:id          findById
GET    /admin/api/:collection/by/:f/:v     findByField
POST   /admin/api/:collection              create
PATCH  /admin/api/:collection/:id          update
DELETE /admin/api/:collection/:id          delete
POST   /admin/api/:collection/:id/restore  restore
GET    /admin/api/csrf                     csrfToken
GET    /admin/api/health                   health
```

**Error envelope:** `{ data, nextCursor? }` on success; `{ error: { code, ...fields } }` on failure — produced by mapping typed `HttpApiError` + domain errors to the envelope shape.

**Note on typed mutations / RPC:** the default is the `HttpApi` REST surface for all operations. `@effect/rpc` is available for a separate binary RPC channel — decision deferred, not assumed.

### Usage

```ts
// app/server/voila.ts — VENDED, ~3 lines you own
import { makeHandler } from "@voila/content/server"
import config from "~/content.config"

export const voilaHandler = makeHandler(config)
// Optionally wrap with middleware:
// export const voilaHandler = (req) => myRateLimiter(req) ?? makeHandler(config)(req)
```

Power user — add endpoints to the same `HttpApi`:

```ts
import { voilaApi } from "@voila/content/server"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "@effect/platform"

const webhooksGroup = HttpApiGroup.make("webhooks")
  .add(HttpApiEndpoint.get("list", "/admin/api/webhooks"))

const extendedApi = HttpApi.add(voilaApi, webhooksGroup)
```

### Extension points (A′)

- `HttpApi.add(voilaApi, myGroup)` — custom groups are reflected in the derived client and OpenAPI spec automatically.
- Replace `SessionMiddleware` by providing a different `Auth` `Layer` (see `@voila/content-auth`).
- `--eject-server` flag on `voila add` vends the full `HttpApi` definition + handlers for teams that need to own them. Not the default.

---

## Typed Client (`@voila/content/client`)

**Layer:** L5. **Status:** M3 target (co-ships with `/server`).

Derived from `voilaApi` via `HttpApiClient.make`; never hand-written. Consumer-facing API is plain async/await — no Effect types leak to the Head.

### Public API

```ts
export declare const createClient: <C extends AnyContent>(
  options: CreateClientOptions,
) => ContentClient<C>

export interface CreateClientOptions {
  baseUrl: string           // e.g. "/admin/api"
  fetch?: typeof globalThis.fetch
  headers?: Record<string, string>
}

// ContentClient<C> — fully typed per-collection namespace
// client.posts.list()             → Promise<{ data: Post[]; nextCursor: string | null }>
// client.posts.find("id")         → Promise<Post>
// client.posts.findOne({ slug })  → Promise<Post>
// client.posts.create(doc)        → Promise<Post>
// client.posts.update("id", patch)→ Promise<Post>
// client.posts.delete("id")       → Promise<void>
// client.posts.restore("id")      → Promise<Post>
```

Non-2xx responses decode the error envelope and throw a typed `ContentClientError` carrying the `code` discriminator.

### Usage

```ts
// In a TanStack Query loader — no Effect
import type content from "~/content.config"
import { createClient } from "@voila/content/client"

const client = createClient<typeof content>({ baseUrl: "/admin/api" })
const { data: posts, nextCursor } = await client.posts.list({ limit: 20 })
```

SSR (forward session cookie):

```ts
const client = createClient<typeof content>({
  baseUrl: "/admin/api",
  headers: { cookie: request.headers.get("cookie") ?? "" },
})
```

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
| `@effect/platform` `HttpApi*` | REST surface in `/server` |
| `HttpApiClient` | Client derivation in `/client` |
| `OpenApi.fromApi` | OpenAPI spec in `/server` |
| `effect/Schema` | Request/response codecs; task payload schemas; localized field wrapping |
| `Schedule` | Retry/backoff in task layer |

## Dependencies

```
@voila/content-schema   # field schemas, InferDoc, Locale
@voila/content-sql      # Database Service
@voila/content-storage  # Storage Service
@voila/content-auth     # Auth Service (session enforcement in /server)
@effect/platform        # HttpApi*, HttpApiClient
effect
```

## Testing

- **Core:** each `Service` resolved against test-double `Layer`s (in-memory `Database`) via `Layer.toRuntime`; mutation validation asserts typed `ValidationError`; hook ordering verified.
- **HTTP:** handler logic tested in-process via `HttpApiBuilder`; integration test spins a real `HttpServer`; asserts envelope shape, CSRF rejection, 401 on missing session.
- **Client:** `createClient` against a test server; asserts typed responses and `ContentClientError` on non-2xx.
- **Tasks:** `InlineLive` makes task handler tests deterministic without any external service.
- **Wiring:** `defineContent` with minimal config produces a `ManagedRuntime` that resolves without errors using in-memory SQLite.

---

Continue → [content-schema.md](./content-schema.md) · [content-sql.md](./content-sql.md) · [content-storage.md](./content-storage.md) · [content-auth.md](./content-auth.md)
