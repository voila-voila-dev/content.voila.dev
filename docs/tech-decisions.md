# Tech Decisions

The load-bearing choices and why we made them. Each is reversible behind an
adapter or a vended file — none is a one-way door.

## Engine: plain TypeScript (not Effect)

We built an Effect-based engine and removed it. Effect gave typed errors, DI, and
composability, but it leaked into the public surface, shrank the contributor pool
to Effect experts, and taxed adoption for power most users never needed.

**Decision:** the engine is ordinary TypeScript with zero runtime framework. The
public API is plain functions and Standard Schema. Effect is gone.
**Trade-off:** we hand-roll a little plumbing (a tiny validator kit, a small DB
layer) instead of getting it from a framework — worth it for a surface any TS
developer can read and extend.

## Validation: Standard Schema

Fields implement [Standard Schema](https://standardschema.dev) (`~standard`).

**Decision:** ship a zero-dependency validator kit (`std/`: `str`, `num`,
`struct`, `union`, `refine`…), but accept *any* Standard Schema at the boundary,
so Zod / Valibot / ArkType interoperate. Doc-shape types are inferred from the
field's output type — no codegen.
**Why:** ecosystem interop with no adapter layer; one validator contract on both
client and server; the wider TanStack/React form world already speaks the spec.

## Head: the full TanStack stack

**Decision:** Router + Start (routing, SSR, server routes, edge deploy), Query
(reads), Table (lists), Form (editing), optionally DB (optimistic mutations).
**Why:** one ecosystem the audience already knows; no bespoke state/form/sync
layer to teach or maintain. The admin *is* a TanStack subtree.

## Distribution: a config-driven admin package (not vended files)

**Decision:** the admin is a versioned package, `@voila/content-admin`, that
produces every CRUD screen, the server wiring, and the layout from your config —
"pure config, no eject" ([ADR 0003](./decision-records/0003-admin-framework-package.md)).
A site keeps only a tiny fixed set of route shims, its `content.config.ts`,
`wrangler.jsonc`, and `.env`. Customization (screens, nav, slots, widgets, auth)
is config threaded into the package, not copied source.
**Why:** to run many small admins, an upstream fix must be a `bun update`, not a
re-vend across N repos. (An earlier shadcn-style `voila add` registry was built
then removed — see ADR 0003.) The escape hatch is to fork a screen component and
pass it back through `defineAdmin`.

## UI: two packages

**Decision:** split the UI in two.

- **`@voila/ui`** — primitives: shadcn-on-[Base UI](https://base-ui.com),
  Tailwind v4 tokens, Phosphor icons. Generic, styleable, no CMS knowledge.
- **`@voila/content-ui`** — schema-aware blocks that compose primitives from your
  config: `DataTable`, `CollectionForm`, `FieldRenderer`, `AdminShell`,
  `ListView`/`DetailView`, widgets.

**Why:** the split is the "write almost no UI" promise. Blocks read field
metadata so columns, cells, and inputs build themselves; primitives stay reusable
for one-offs.

## Persistence: thin adapters, edge-first

**Decision:** the database is a small query interface with adapters —
`bun:sqlite` / Cloudflare D1 / Postgres. Storage is R2 / S3-compatible. Each is a
swappable adapter passed to `defineConfig`. No `@effect/sql`, no heavy ORM.
**Why:** Cloudflare is the happy path without lock-in; swapping a backend is an
import, not a fork.

## Migrations: generated, never automatic

**Decision:** `voila migrate generate` emits DDL from field definitions into a
journal; `voila migrate apply` runs it against the chosen target. Never runs on
its own.
**Why:** schema changes are deliberate and reviewable; no surprise migrations.

## CLI: plain TypeScript

**Decision:** `voila` is a small pure-TS binary (`node:util` arg parsing), no CLI
framework. Lives in `@voila/content-cli` alongside the SQL/migrate code.
**Why:** consistent with the engine — nothing to learn, nothing heavy to ship.

## Repo & tooling

**Decision:** Bun workspaces monorepo, Biome (lint + format), Changesets
(lock-step `@voila/*` versions), one `tsc -b` project graph.
**Why:** fast, single-config, low-ceremony.

## Package map

All `@voila/content*` packages are published (0.2.x); `@voila/ui` and
`@voila/rich-text-editor` ship from their own repos.

| Package | Role |
| --- | --- |
| `@voila/content` (`/server`, `/client`) | `defineConfig` + fields, REST + typed client + auth (pure TS, Standard Schema) |
| `@voila/content-cli` | `voila` CLI + SQL/DDL/migrate |
| `@voila/content-ui` | schema-aware blocks & layouts |
| `@voila/content-admin` | config-driven admin framework (CRUD screens, Cloudflare wiring) |
| `@voila/ui` | primitives (shadcn-on-Base-UI) |
| `@voila/rich-text-editor` | Plate editor + node components |

→ [Philosophy](./philosophy.md) · [Developer Experience](./dx.md) · [Roadmap](./roadmap.md)
