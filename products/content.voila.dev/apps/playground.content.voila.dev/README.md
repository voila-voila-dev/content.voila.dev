# playground.content.voila.dev

The canary app for `@voila/content`. Boots a real TanStack Start app on
the Cloudflare runtime (Miniflare via `@cloudflare/vite-plugin`) and
exercises the M0 admin shell.

## First-run

```bash
bun install
cp .dev.vars.example .dev.vars   # then edit VOILA_AUTH_SECRET
bun dev
# → http://localhost:8787/admin
```

That's it for the M0 smoke test. The admin shell at `/admin` renders an
empty branded scaffold; `/admin/api/health` returns the package health
JSON; `/admin/setup` shows the first-run placeholder.

## D1 (when you need a real database binding)

`wrangler.jsonc` declares a D1 binding `DATABASE`. Provision it once:

```bash
wrangler d1 create voila-playground
# paste the returned database_id into wrangler.jsonc
bun run db:init    # wrangler d1 execute DATABASE --local --file=migrations/0000_init.sql
```

The M0 schema is a single `_voila_meta` table. M1 lands the
schema-to-table generator in `@voila/content-database` and this
migration gets regenerated from the collection registry.

## Deploy

```bash
bun run deploy
```

`bun run build && wrangler deploy`. Requires `wrangler login` once.

## File layout

- `content.config.ts` — the source of truth, auto-discovered by the
  `voila()` vite plugin. Add collections + singletons here.
- `src/routes/` — TanStack Router file routes. The plugin **generates**
  `src/routes/admin/` on every `vite dev`; that subtree is gitignored
  and should not be edited.
- `wrangler.jsonc` — Cloudflare bindings. D1 active; R2 (M3) and Queues
  (M5) are commented placeholders.
- `migrations/` — D1 schema migrations applied by `bun run db:init`.
