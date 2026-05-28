# @voila/content-sync

> Local-first sync substrate for the Head: LiveStore client + Cloudflare
> Durable Object event log adapter, exposed as Effect `Layer`s. **World:**
> Engine (DO + materializer) + Head (vended LiveStore Provider).
> **Status:** Effect pivot target — **M3**.

## Responsibility

Wraps LiveStore (`@livestore/client` + `@livestore/sync-cf` +
`@livestore/adapter-web`) as Effect `Layer`s and provides the Cloudflare
Durable Object that materializes synced events into the engine. Owns:

1. **The event `Schema`s** (`effect/Schema`) — `createPost`, `updatePost`,
   `deletePost`, `restorePost`, etc. — derived from the project's collection
   schemas at build time. Same shape on client (LiveStore `commit`) and server
   (REST `HttpApi` handler).
2. **The `Sync` Service** — Engine-side tag with the default `LiveStoreCfLive`
   `Layer`; swappable for tests (`LiveStoreLocalLive`) or alternate transports.
3. **The DO materializer** — `makeSyncDurableObject(config)` returns the
   `DurableObject` class users register in `wrangler.toml`. On every push the
   DO authenticates the WebSocket, verifies the CSRF token, runs
   `MutationService.validateWrite`, and appends to the D1 event log on success.
4. **Server↔client convergence** — REST write handlers in `@voila/content/server`
   commit the same event shape, so MCP / public / admin clients project the
   same content state.

Does **not** own: SQL (`@voila/content-sql`), storage (`@voila/content-storage`),
or React (the LiveStore Provider is *vended* via `@voila/content-registry`).

---

## Subpath exports

| Import | What it contains |
| --- | --- |
| `@voila/content-sync` | Core: `Sync` Service tag, event-schema derivation helpers (`deriveEventSchema(collection)`), shared types |
| `@voila/content-sync/livestore-cf` | `LiveStoreCfLive(config)` Layer + `makeSyncDurableObject(config)` (keeps `cloudflare:workers` + LiveStore CF transport out of the main bundle) |
| `@voila/content-sync/livestore-local` | `LiveStoreLocalLive` Layer — in-memory adapter for unit tests; no network, no DO. Used by `@voila/content` resolver tests when they need a sync target. |

---

## Public API

```ts
// Service tag (Engine seam — same pattern as Database, Storage, Queue)
export declare class Sync extends Context.Tag("@voila/content-sync/Sync")<
  Sync,
  {
    // Server-side: append a pre-validated event to the log
    append(event: ContentEvent): Effect.Effect<void, SyncError>
    // Server-side: replay log into a fresh projection
    replay(opts: { since?: bigint }): Stream.Stream<ContentEvent, SyncError>
  }
>() {}

// LiveStore + Cloudflare DO Layer (default in M3)
export declare const LiveStoreCfLive: (config: {
  binding: DurableObjectNamespace      // wrangler binding
  d1: D1Database                        // event log DB
  storeId: string                       // typically content.config name
}) => Layer.Layer<Sync, never, MutationService | RbacService>

// In-memory Layer for tests
export declare const LiveStoreLocalLive: Layer.Layer<Sync>

// DO class factory — exported from the user's worker entry
export declare const makeSyncDurableObject: (config: SyncConfig) => {
  new (state: DurableObjectState, env: unknown): DurableObject
}

// Event schema derivation — same `effect/Schema` used by REST + form
export declare const deriveEventSchema: <C extends Collection>(
  collection: C,
) => {
  create: Schema.Schema<CreateEvent<C>>
  update: Schema.Schema<UpdateEvent<C>>
  delete: Schema.Schema<DeleteEvent<C>>
  restore: Schema.Schema<RestoreEvent<C>>
}
```

---

## How the DO works

```
┌─────────────┐  ws upgrade ┌─────────────────┐  validateWrite  ┌──────────┐
│ LiveStore   │ ──────────▶ │ Sync DO         │ ─────────────▶  │ Mutation │
│ (browser)   │  commit(ev) │ (per storeId)   │   (Schema)      │ Service  │
└─────────────┘             └──────┬──────────┘                 └────┬─────┘
       ▲                            │ append                          │
       │ pull / reactive            ▼                                 ▼
       │                     D1 event log  ◀───────── REST POST/PATCH (HttpApi handler also calls validateWrite + Sync.append)
       └─── reactive query ──── projection tables
```

**On WebSocket upgrade:**
1. Read `voila_session` + `voila_csrf` cookies + `x-voila-csrf` from the
   upgrade request.
2. Resolve session via `Auth` Service; reject 4401 if unauthenticated.
3. Verify HMAC double-submit token; reject 4401 if mismatch.
4. Accept; bind socket to session.

**On every `onPush(event)`:**
1. Decode event with `deriveEventSchema(collection).<op>` → `ValidationError`
   on failure (sent back to client; identical shape to REST 422 envelope).
2. Call `MutationService.validateWrite(event, session)` (RBAC + business
   rules).
3. Append to D1 event log (idempotent on `event.id`).
4. Broadcast to other sockets in the same storeId.

**Replay** — projection tables are rebuilt from the log on materializer
startup (or via `voila migrate apply` after a schema change).

---

## Three-way convergence (RPC + derived HttpApi + LiveStore)

`@voila/content/server` RPC mutation procedures and the derived HttpApi
handler internally call the same Effect:

```ts
import { Sync } from "@voila/content-sync"
import { MutationService } from "@voila/content"

// posts.update RPC procedure (and the derived HttpApi PATCH handler) —
// simplified
const updateHandler = (patchEvent: PatchEvent) =>
  Effect.gen(function* () {
    const mutation = yield* MutationService
    const sync     = yield* Sync
    const event    = yield* mutation.validateWrite(patchEvent)   // shared Schema
    yield* sync.append(event)                                     // same log
    return yield* mutation.applyToProjection(event)
  })
```

LiveStore's DO materializer calls the same `MutationService.validateWrite` +
`Sync.append`. So three paths converge on one event log + one projection:

1. **RPC mutation** (admin Head — RpcClient; external programmatic clients).
2. **Derived HttpApi handler** (MCP HTTP transport; `--eject-server`).
3. **LiveStore commit** (admin Head via `@effect-atom/atom-livestore`).

Tested as the **M3 three-way convergence integration test**.

---

## Vended Head wiring (via `@voila/content-registry`)

`admin-shell` (M3+) vends `app/lib/livestore.ts`:

```ts
// app/lib/livestore.ts — VENDED, you own this
import { makeAdapter } from "@livestore/adapter-web"
import { makePersistedAdapter } from "@livestore/adapter-web/persisted"
import { LiveStoreProvider } from "@livestore/react"
import { makeCfSync } from "@livestore/sync-cf"
import { schema } from "@voila/content-sync/schema"   // derived from content.config
import content from "~/content.config"

const adapter = makePersistedAdapter({
  storage: { type: "opfs" },
  sync: { backend: makeCfSync({ url: "/admin/api/sync" }) },
})

export function VoilaLiveStoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <LiveStoreProvider schema={schema} adapter={adapter} storeId={content.branding.name}>
      {children}
    </LiveStoreProvider>
  )
}
```

The provider sits above the admin shell in `app/routes/admin.tsx` (also
vended). `@voila/content/client/atoms` factory detects the provider and
dispatches read/write atoms through **`@effect-atom/atom-livestore`** against
the project LiveStore (replacing the M1–M2 RPC-client backend, with identical
atom shape).

---

## `wrangler.jsonc` additions (M3)

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "VOILA_SYNC", "class_name": "VoilaSyncDO" }]
  },
  "migrations": [{ "tag": "v1", "new_classes": ["VoilaSyncDO"] }]
}
```

Worker entry exports the DO class:

```ts
import { makeSyncDurableObject } from "@voila/content-sync/livestore-cf"
import config from "~/content.config"
export const VoilaSyncDO = makeSyncDurableObject({ config })
```

`voila migrate` patches both `migrations` and `durable_objects.bindings`
sections in M3+.

---

## Dependencies

```
@voila/content-schema           # event Schema derivation
@voila/content                  # MutationService, RbacService, Auth
@voila/content-sql              # event log table + projection helpers
@livestore/client               # core client runtime
@livestore/sync-cf              # CF DO + D1 transport
@livestore/adapter-web          # browser adapter (peer; consumed by vended Provider)
@livestore/react                # React bindings (peer; consumed by vended Provider)
effect, @effect/platform
```

LiveStore is **beta v0.3.x**. The package pins exact LiveStore versions; minor
upgrades are treated as breaking until LiveStore reaches 1.0.

---

## Testing

- **Unit:** event-schema derivation per collection type (golden, parallels the
  DDL generator goldens in `@voila/content-sql`).
- **Unit:** DO upgrade handshake — session ok / session bad / CSRF mismatch.
- **Integration (`LiveStoreLocalLive`):** commit → materializer → projection
  → reactive query, end-to-end in-memory; failure path asserts the
  `ValidationError` envelope.
- **Integration (CF):** Miniflare DO + D1; round-trip from a fake browser
  client; chaos test kills the DO mid-write and asserts no duplicate.
- **Three-way convergence:** RPC mutation, derived HttpApi handler, and
  LiveStore `commit` all produce identical event log entries; projection
  invariant holds.
- **Security:** unauthenticated WS upgrade → 4401; CSRF mismatch → socket close.

---

Continue → [content.md](./content.md) · [content-schema.md](./content-schema.md) · [content-sql.md](./content-sql.md) · [content-auth.md](./content-auth.md) · [content-registry.md](./content-registry.md)
