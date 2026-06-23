# {{projectName}}

A content-managed admin built with [TanStack Start](https://tanstack.com/start)
and [voila](https://voila.dev), deployed as a single Cloudflare Worker
(one Worker · one D1 · one R2 · one domain). Your `content.config.ts` is the
source of truth — the admin UI, the typed client, and the database schema all
derive from it. The admin itself lives in `@voila/content-admin`; updating it is a
version bump (`bun update @voila/content-admin`), not an edit.

## Develop

```bash
bun install
bun run migrate:local       # apply the schema to a local D1 (Miniflare)
bun run dev                 # → http://localhost:3000  (the admin is the whole site)
```

`bun run dev` runs the app in a local workerd with local D1 + R2 — the same
runtime as production, so dev and prod don't diverge.

## Sign in

The admin is **secure by default** — authentication, CSRF, and access control are
built in. Open `/` and you'll be sent to `/login`. Enter an email; in
development the magic-link URL prints to the dev console (look for
`[voila/auth] magic link`). **The first account to sign in becomes the admin.**

## Make a change

Edit `content.config.ts` — add a collection or a field — then:

```bash
bun run migrate:generate    # SQL from your fields (+ auth tables) → migrations/
bun run migrate:local       # apply to local D1
```

A new collection shows up in the admin automatically: the dynamic `$collection`
routes serve its list/create/edit pages with **no new files**.

## Customize without ejecting

Everything is configured in `app/lib/admin.ts` via `defineAdmin`:

- **Custom screens** — `screens: [{ id, path, nav, component }]` (mounted with no
  new route file).
- **Slots** — dashboard cards, header actions, sidebar footer, list/detail actions.
- **Field widgets** — `widgets: { edit, display }` overrides per kind.
- **Branding** — `branding: { title }`.

## Deploy

```bash
wrangler d1 create {{projectName}}              # paste database_id into wrangler.jsonc
wrangler r2 bucket create {{projectName}}-media
bun run migrate:remote                          # apply schema to remote D1
wrangler secret put VOILA_AUTH_SECRET           # value is in .env
bun run deploy                                  # build + wrangler deploy
```

The Worker serves at `admin.{{clientDomain}}` (set in `wrangler.jsonc`). Remove
that `routes` block to use the default `*.workers.dev` URL instead.
