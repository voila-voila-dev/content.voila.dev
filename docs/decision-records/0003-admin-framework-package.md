# ADR 0003 — A config-driven admin framework package (`@voila/content-admin`)

**Accepted 2026-06-23 · Partially supersedes [ADR 0002](./0002-tanstack-start-integration.md)**

## Context

We want to run **hundreds of tiny CMS admins** — one per small website — each as
**one Cloudflare Worker, one D1 database, one R2 bucket, one (sub)domain**
(`admin.CLIENTDOMAIN.TLD`). Two goals are in tension:

1. **Minimum to maintain.** A new site should be essentially `content.config.ts`
   + `wrangler.jsonc` + `.env`. Fixing or improving the admin across every site
   should be a **version bump**, not a per-repo edit.
2. **Fully customizable.** A site must still be able to add custom screens,
   routes, nav, widgets, and auth — without forking.

ADR 0002 chose **vended source files** (shadcn-style): every route/layout/server
file is copied into each app and owned there. That maximizes ownership, but for
*hundreds* of sites it inverts goal 1 — hundreds of drifting copies, and an
upstream fix means re-vending everywhere.

## Decision

Introduce **`@voila/content-admin`**, a thin "framework on top of TanStack Router/Start"
that produces the entire admin from config:

- A single `defineAdmin(config, options)` yields the router factory, the
  `/admin/api` handler, the session/guard helpers, the typed client, and all
  generic CRUD screens.
- `@voila/content-admin/cloudflare` exposes `createWorkerAdmin(config, options?)`, wiring
  the D1 driver + R2 storage + Better Auth + REST handler from
  `cloudflare:workers` `env`. All admin *logic* lives in the versioned package.
- **Generic CRUD is served by dynamic `$collection` routes** — one definition
  serves every collection. Adding a collection is a `content.config.ts` edit;
  **zero new files**.
- **Customization is "pure config, no eject":** custom screens are registered as
  config objects (`screens: [{ path, nav, loader, component }]`) and mounted by a
  catch-all dispatcher; nav/slots/widgets/auth are options threaded into existing
  `@voila/content-ui` primitives. A custom route becomes **data, not a file**.

### The unavoidable constraint (honest tradeoff)

**TanStack Start supports file-based routing only.** A package cannot own the
route tree via code-based or virtual routes (confirmed by a TanStack maintainer;
issues [#5599](https://github.com/TanStack/router/discussions/5599),
[#5808](https://github.com/TanStack/router/issues/5808); virtual-file-routes
cannot resolve `node_modules` paths, [#4984](https://github.com/TanStack/router/issues/4984)).
So a site keeps a **fixed, tiny set of dynamic `$collection` route shims**
(1–3 lines each, re-exporting `@voila/content-admin` screens). These shims **never change
as collections grow** — per-collection files go from N×3 to a fixed ~6 total.

## Why this partially supersedes ADR 0002

ADR 0002 rejected build-time magic (a Vite plugin / virtual routes) because it
was a black box that broke "you own your code." This ADR keeps that principle for
the *route shims* — they remain real, greppable files in the host — while moving
the *churning logic* (CRUD screens, server wiring, layout) into a versioned
package so it can be fixed once and shipped everywhere. **No Vite plugin and no
virtual routes are introduced.** The shadcn-style registry/vending of ADR 0002
(the `@voila/content-registry` package and `voila add`/`list`/`diff`) is fully
superseded by this package and has been removed; the supported escape hatch is
now to fork a screen component and pass it back through `defineAdmin`.

## Consequences

- A scaffolded site's hand-maintained surface is `content.config.ts` +
  `wrangler.jsonc` + `.env`, plus never-touched build config and generated-once
  shims. `bun update @voila/content-admin` upgrades the admin everywhere.
- Custom screens lose per-route `createFileRoute` param/loader typing through the
  dispatcher; the eject hatch (a literal route shim, which out-ranks
  `$collection`) restores full typing when needed.
- `@voila/content-admin` depends on `@voila/content` and `@voila/content-ui`. No change
  to `@voila/content` is required: `makeD1Driver` / `makeR2Storage` /
  `makeMediaStore` are already exported from `@voila/content/server`.
- TanStack Start remains the only supported head.
