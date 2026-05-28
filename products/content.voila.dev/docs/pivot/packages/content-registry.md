# @voila/content-registry

> The `registry.json` manifest and the vended source files for L6–L11 (route
> files, admin shell, tables, forms, widgets, theme). **World:** Tooling → Head.
> **Status:** Effect pivot target (new package).

## Responsibility

Owns the **catalog of registry items** and the **source files that `voila add`
copies** into a consumer's app. Authoritatively sources every vended UI
component; references `@voila/ui` primitives and `@voila/rich-text-editor` as
dev dependencies so its components compile during authoring.

Does **not** ship as a runtime npm dependency in consumer apps. It is consumed
only by the `@voila/content-cli` registry commands at "vend time." **Vended
files may import `effect`, `effect/Schema`, `@effect/rpc` (client only),
`@effect-atom/atom-react`, `effect-form`, and (from M3) `@livestore/client`
/ `@livestore/react` / `@livestore/sync-cf` / `@effect-atom/atom-livestore`**
— these are the Head's transport, state, form, validation, and sync
primitives (Canon §1 + §6 + §10). Vended files must **not** import
`@voila/content/server` (the RPC handler/RpcGroup definition) or any other
Engine package; the Engine surface remains `@voila/content/client` (+
`/client/atoms`), `@voila/content-schema`, and (M3+) `@voila/content-sync`.

## Public API / Commands

The package surface is **`registry.json`** (the machine-readable catalog) plus
the source files it references. No TypeScript API is exported directly; `@voila/content-cli`
imports an internal `RegistryService` for resolution logic.

### registry.json item shape

```json
{
  "items": [
    {
      "name": "admin-shell",
      "type": "registry:component",
      "description": "Admin layout, sidebar, and login route",
      "files": [
        { "path": "app/routes/admin.tsx",              "target": "app/routes/admin.tsx" },
        { "path": "app/routes/admin/index.tsx",        "target": "app/routes/admin/index.tsx" },
        { "path": "app/routes/admin_.login.tsx",       "target": "app/routes/admin_.login.tsx" },
        { "path": "app/server/voila.ts",               "target": "app/server/voila.ts" }
      ],
      "deps": ["@tanstack/react-router", "@tanstack/start"],
      "registryDeps": ["theme"]
    },
    {
      "name": "posts-table",
      "type": "registry:component",
      "files": [
        { "path": "app/routes/admin/collections.posts.index.tsx", "target": "..." }
      ],
      "deps": [],
      "registryDeps": ["admin-shell", "data-table", "lib/voila-atoms"]
    },
    {
      "name": "lib/voila-atoms",
      "type": "registry:lib",
      "description": "Per-collection effect-atom factory (read/write atoms derived from @voila/content/client/atoms). M1 backend = RPC client; M3 backend = @effect-atom/atom-livestore.",
      "files": [
        { "path": "app/lib/voila-atoms.ts", "target": "app/lib/voila-atoms.ts" }
      ],
      "deps": ["@effect-atom/atom-react", "@effect/rpc", "effect"],
      "registryDeps": []
    },
    {
      "name": "field/string",
      "type": "registry:component",
      "description": "String field widget (effect-form field atom)",
      "files": [
        { "path": "app/components/admin/fields/string.tsx", "target": "..." }
      ],
      "deps": ["effect", "effect-form", "@effect-atom/atom-react"],
      "registryDeps": ["lib/voila-atoms"]
    },
    {
      "name": "theme",
      "type": "registry:style",
      "files": [{ "path": "app/styles/voila.css", "target": "app/styles/voila.css" }],
      "deps": [],
      "registryDeps": []
    }
  ]
}
```

## How it works

### `voila add <item>` resolution

1. `@voila/content-cli` fetches `registry.json` (local package or hosted manifest URL).
2. Resolves the item's `registryDeps` graph (breadth-first, deduped).
3. For each resolved item: copies `files` into the consumer's repo (respecting
   `target` paths), rewrites `~voila/` import aliases to the consumer's path
   convention, installs `deps` via the detected package manager.
4. Skips files already identical to the upstream source (no-op rerun).

### The thin L6 mount file pattern

Every `admin-shell` add includes `app/server/voila.ts` — a ~3-line file the
user owns and can extend:

```ts
// app/server/voila.ts — VENDED, you own this
import { makeHandler } from "@voila/content/server"
import config from "~/content.config"

export const voilaHandler = makeHandler(config)
// add auth middleware, rate limiting, extra routes here
```

The handler logic stays inside `@voila/content/server` (Engine dependency). The
user controls the mount point, path prefix, and any wrapping middleware.

### `voila diff`

Compares each vended file against the current upstream source in `@voila/content-registry`
(using the installed package version). Outputs a unified diff per file; exits
non-zero if drift exists. Suitable for CI.

### `--eject-server`

When passed to `voila add`, additionally copies the `HttpApi` definition and
handler wiring from `@voila/content/server` into `app/server/voila-handlers.ts`.
This is the residual Option B case — teams that need full ownership of server
behavior for audit or compliance. Not the default; explicitly opt-in only.

### How vended source is authored

Source lives under `packages/registry/src/items/`. Files are written as
**TanStack Router + React + `@effect/rpc` (client) + `effect-atom` +
`effect-form`** (M1+) and **`@livestore/react` + `@effect-atom/atom-livestore`**
(M3+). They import:

- `@voila/content/client` — typed RPC client (Effect-native + thin async
  sugar; used by SSR loaders and non-atom call sites).
- `@voila/content/client/atoms` — reactive `effect-atom` bindings (default for
  list/detail/widget components; backend swaps from RPC → atom-livestore at M3).
- `@voila/content-schema` — field schemas reused for form validation.
- `@voila/ui` — primitives.
- `effect`, `effect-form`, `@effect-atom/atom-react`, `@effect/rpc` (client),
  `@effect-atom/atom-livestore` + `@livestore/*` (M3+) — transport, state,
  form, sync primitives.

No imports from `@voila/content/server`, `@voila/content-sql`,
`@voila/content-storage`, `@voila/content-auth`, or any other Engine package.
The registry build step copies items into `dist/registry/` alongside
`registry.json`.

### `admin-shell` vending (M3+)

Starting M3, the `admin-shell` item also vends `app/lib/livestore.ts` — the
`LiveStore.Provider` wired with the project's schema + `makeCfSync({ url:
"/admin/api/sync" })`. The vended file imports `@livestore/react` and
`@livestore/sync-cf`; consumers can swap the sync URL or layer their own auth
headers without ejecting the engine.

## Dependencies

**Dev (authoring) only:**
- `@voila/ui` — Button, Table, Sidebar, etc. (source-of-truth for UI items)
- `@voila/rich-text-editor` — `RichTextEditor` (sourced into the `field/rich-text` item)
- `@voila/content/client` + `@voila/content/client/atoms` — typed RPC client
  and reactive atom factory used in vended route/component files
- `@effect/rpc`, `@effect-atom/atom-react`, `effect-form`, `effect` — peer
  deps declared on individual items; `voila add` installs them per the item
  manifest
- `@livestore/client`, `@livestore/react`, `@livestore/sync-cf`,
  `@effect-atom/atom-livestore` — peer deps declared on `admin-shell` from M3
  onward

**Internal (consumed by `@voila/content-cli`):**
- `effect` — `RegistryService` Effect program (resolution logic only, not vended)

## Usage

```bash
# Add the full admin UI in one command
voila add admin-shell

# Add just a table view; data-table dep resolved automatically
voila add posts-table

# Check for drift after upgrading @voila/content-registry
voila diff

# List everything available
voila list
# admin-shell   Admin layout, sidebar, login
# data-table    Sortable/filterable TanStack Table wrapper
# posts-table   Collection list view for "posts"
# field/string  String field widget
# field/rich-text  Plate rich-text widget
# theme         Tailwind v4 token layer
```

```ts
// Vended table route — what the user owns after `voila add posts-table`
// app/routes/admin/collections.posts.index.tsx
import { createFileRoute } from "@tanstack/react-router"
import { Atom, useAtomValue } from "@effect-atom/atom-react"
import { postsListAtom } from "~/lib/voila-atoms"
import { DataTable } from "~/components/admin/data-table"

export const Route = createFileRoute("/admin/collections/posts/")({
  component: PostsListPage,
})

function PostsListPage() {
  const posts = useAtomValue(postsListAtom)
  if (posts._tag !== "Success") return <Skeleton />
  return <DataTable rows={posts.value.data} />
  // In M3+, postsListAtom dispatches to a LiveStore reactive query — same atom shape.
}
```

## Replaces

- The `voila()` vite plugin (`packages/content/src/vite.ts`) and its
  `writeAdminRoutes` function — virtual route generation replaced by real files
  the user owns. The `GENERATED_HEADER` / gitignore pattern is retired; users
  track their own vended files in git.
- The `content/src/routes/` source templates (`admin-layout.ts`,
  `admin-views.ts`, etc.) — ported and extended into `@voila/content-registry` items,
  rewritten to use `@voila/content/client` instead of direct server-fn calls.
- The `content/src/admin/` React components — salvaged and re-homed as registry
  items (L8–L10) and widget items (L11), stripped of any `@voila/content`
  server imports.

## Testing

- Snapshot tests: `voila add admin-shell` into a temp directory; assert the file
  tree matches the expected snapshot (files present, import aliases rewritten).
- `voila diff` test: mutate one vended file, assert diff output is non-empty and
  exit code is 1.
- `registryDeps` resolution: unit test the graph walker with a mock
  `registry.json`; assert topological order and deduplication.
