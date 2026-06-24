# demo

A content-managed app built with [TanStack Start](https://tanstack.com/start)
and [voila](https://voila.dev). Your `content.config.ts` is the source of
truth — the admin UI, the typed client, and the database schema all derive
from it.

## Develop

```bash
bun install
voila migrate generate --auth   # SQL from your fields (+ auth tables) → migrations/
voila migrate apply             # apply to ./local.db — the file the app opens too
cp .env.example .env     # then set VOILA_AUTH_SECRET (openssl rand -base64 32)
bun dev                  # → http://localhost:3000  (admin at /admin)
```

## Sign in

The admin is **secure by default** — auth, CSRF, and access control are wired in
`app/lib/server.ts`. Open `/admin` and you'll be sent to `/admin/login`. Enter an
email; in development the magic-link URL is printed to the dev server terminal
(`[voila/auth] magic link …`). Open it to sign in. **The first account to sign in
becomes the admin**; later emails authenticate but are denied access.

## Make a change

Edit `content.config.ts` — add a collection, add a field — then:

```bash
voila migrate generate --auth && voila migrate apply
```

The admin list, detail, and create/edit forms update automatically; you write
no table columns and no form fields.

## Own the UI

The admin shell and pages under `app/` are yours. Restyle `app/styles.css`
(override any token), edit `app/components/admin-layout.tsx`, or vend more
blocks with `voila add`. Run `voila list` to see what's available.
