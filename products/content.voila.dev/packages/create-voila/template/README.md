# {{projectName}}

A content-managed app built with [TanStack Start](https://tanstack.com/start)
and [voila](https://voila.dev). Your `content.config.ts` is the source of
truth — the admin UI, the typed client, and the database schema all derive
from it.

## Develop

```bash
bun install
voila migrate generate   # SQL from your fields → migrations/
voila migrate apply      # apply to a local SQLite db
bun dev                  # → http://localhost:3000  (admin at /admin)
```

## Make a change

Edit `content.config.ts` — add a collection, add a field — then:

```bash
voila migrate generate && voila migrate apply
```

The admin list, detail, and create/edit forms update automatically; you write
no table columns and no form fields.

## Own the UI

The admin shell and pages under `app/` are yours. Restyle `app/styles.css`
(override any token), edit `app/components/admin-layout.tsx`, or vend more
blocks with `voila add`. Run `voila list` to see what's available.
