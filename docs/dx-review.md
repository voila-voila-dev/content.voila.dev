# DX Review

_Last reviewed: 2026-06-23 · branch `chore/split-into-content-only`_

A standing review of developer experience. Update it in place; don't spawn dated
copies. Findings are grouped P1 (blocks the "running admin in one afternoon"
promise) → P3 (polish).

## Live test result

`bun create content-voila <dir>` was run **from npm, outside the workspace**, and
verified end-to-end with no manual fixes: scaffold → `bun install` → `bun run
build` (workerd bundle compiles) → `tsc --noEmit` (0 errors). The create flow
also runs the first migration and `wrangler types` automatically.

The admin is **root-mounted** (each site is its own subdomain, so the admin *is*
the whole site): `GET /` → **307** to `/login` (auth guard), `/login` → **200**,
`/api/posts` → **401** (secure by default). The magic-link flow works end to end
on both Node (`vite dev`) and Cloudflare (`wrangler` local D1): sign-in → verify
→ session → authed read/write. **Auth-by-default is genuinely live.**

## Architecture decisions in this cycle

- **Pure-config admin framework** (`@voila/content-admin`, [ADR 0003](./decision-records/0003-admin-framework-package.md)):
  the admin's CRUD screens, server wiring, and layout live in a versioned package;
  a site is `content.config.ts` + `wrangler.jsonc` + `.env` + a fixed set of
  one-line route shims. Update every site with one version bump. Custom screens /
  nav / slots / widgets are config, not vended files.
- **shadcn-style vending removed.** `@voila/content-registry` and `voila
  add/list/diff` are deleted; the framework supersedes them. The `voila` CLI is
  now `migrate generate|apply` only.
- **One Worker · one D1 · one R2 · one subdomain per site**, root-mounted.
- **Published to npm** (`@voila/content`, `-ui`, `-admin`, `-cli`,
  `create-content-voila`), so the split's duplicate-React blocker is resolved.

## P1 — Blocks onboarding

_None open._ The prior P1 (unpublished `@voila/ui` / `@voila/rich-text-editor`
→ duplicate React → broken `bun test` + uninstallable scaffold) is **resolved**:
all packages are published with `react`/`react-dom` as peer deps, `bun.lock` is
regenerated, and a fresh external scaffold installs and builds.

## P2 — Rough edges

**1. `@voila/ui`'s barrel forces optional peers onto every consumer.**
Its index re-exports `chart.tsx` / `form.tsx`, which statically import the
*optional* peers `recharts` / `react-hook-form`. A clean consumer that doesn't
install them fails the bundler build (rollup can't resolve the optional-peer
stub) even though the admin never uses charts/forms. **Current workaround:** the
scaffold template depends on both. **Proper fix (in the `@voila/ui` repo):** move
`chart`/`form` to subpath exports so the main barrel is peer-free.

**2. `voila seed` / `voila doctor` / `voila mcp` are documented but unimplemented.**
`dx.md` advertises them; the CLI now handles only `migrate`. A `doctor` (config
loads, `VOILA_AUTH_SECRET` set, migrations applied, `database_id` filled before
deploy) would directly de-risk onboarding. Implement, or drop the rows from `dx.md`.

**3. The flagship "actionable errors" example doesn't exist.**
`dx.md` shows `[voila] Field "posts.body" … Fix: …`. Real constructor errors are
bare and nameless (`rich-text: at least one element is required`) because
constructors don't know their own key. Thread the field key + collection slug into
validation (in `defineCollection`/`defineConfig`, where keys are known).

**4. `slug({ from })` and `relation({ to })` take unchecked free strings.**
A typo (`from: "titel"`) is accepted and fails later in the admin. `collection.ts`
already types `titleField` as `keyof Fields & string` — do the same for `from`,
and validate `relation.to` against known collection slugs at normalization time.

## P3 — Polish

**5. `migrate apply` has no Postgres target.** `generate` emits a `postgres`
dialect but `apply` targets are `sqlite | d1-local | d1-remote`. Emit a clear
"Postgres apply lands with the pg client" error and align the docs.

**6. `database_id` placeholder.** A fresh scaffold ships a generated placeholder
`database_id` so `bun run dev` (local miniflare D1) works immediately; it must be
replaced with the real id from `wrangler d1 create` before deploy. A `doctor`
check (see P2.2) should flag the unreplaced placeholder.

**7. `worker-configuration.d.ts` is generated, not committed.** The scaffold runs
`wrangler types` once; it's git-ignored, so a fresh clone must re-run `cf-typegen`
before `tsc` passes (same shape as `routeTree.gen.ts`). Acceptable, but document it.

**8. `loadConfig` error is thin** — "config has no default export with a
`collections` map" should hint `export default defineConfig(...)`.

## What's already strong (keep)

The codegen-free `InferDoc`/typed-client inference; **pure-config, no-eject**
admin (add a collection = a config edit, zero new files; custom screens are
config objects); one-command Cloudflare deploy (one Worker/D1/R2/subdomain); and
auth-secure-by-default. The API design delivers the north star.
