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
only by the `@voila/content-cli` registry commands at "vend time." Effect must not
appear in any vended file — the consumer's codebase stays pure TanStack + React.

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
      "registryDeps": ["admin-shell", "data-table"]
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

Source lives under `packages/registry/src/items/`. Files are written as plain
TanStack + React — no Effect imports. They import from `@voila/content/client`
(typed HTTP client, Engine dep) for data fetching, and from `@voila/ui` for
primitives. The registry build step copies them into `dist/registry/` alongside
`registry.json`.

## Dependencies

**Dev (authoring) only:**
- `@voila/ui` — Button, Table, Sidebar, etc. (source-of-truth for UI items)
- `@voila/rich-text-editor` — `RichTextEditor` (sourced into the `field/rich-text` item)
- `@voila/content/client` — typed client used in vended route files

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
import { useContentClient } from "@voila/content/client/react"
import { DataTable } from "~/components/admin/data-table"

export const Route = createFileRoute("/admin/collections/posts/")({
  component: PostsListPage,
})

function PostsListPage() {
  const client = useContentClient()
  // ... TanStack Query + TanStack Table — no Effect in sight
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
