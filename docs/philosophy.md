# Philosophy

## A CMS that disappears into your app

A headless CMS is not infrastructure you deploy alongside your app. It is a
**feature of your app** — a few packages you depend on plus a handful of real
files vended into your repo. No second server, no second URL, no second auth.

If you can write a TanStack route, you can self-host a CMS.

## Principles

**1. One config is the source of truth.**
You write a single `content.config.ts` with `defineConfig`. From it we derive
the admin UI, the typed client, the REST API, the database migrations, and the
MCP tools. Add a field in one place; it appears everywhere. No codegen step.

**2. Plain TypeScript, no framework lock-in.**
The engine is ordinary TypeScript — no Effect, no runtime metaprogramming, no
concepts to learn beyond the ones you already know. Anyone who reads TS can read,
fork, and contribute. (We tried an Effect-based engine; it taxed adoption and
contributors for power most users never needed. See [tech decisions](./tech-decisions.md).)

**3. Standard Schema, your validator.**
Fields are [Standard Schema](https://standardschema.dev) values. The package
ships a zero-dependency validator, but anything that speaks the spec — Zod,
Valibot, ArkType — drops in. One contract, client and server, no adapter layer.

**4. TanStack-native head.**
The admin is built from TanStack primitives you already know: Router + Start for
routing/SSR/deploy, Query for reads, Table for lists, Form for editing. No second
ecosystem to learn.

**5. Config-driven admin, barely any UI code.**
The admin is a versioned package (`@voila/content-admin`) that renders every
screen from your config — "pure config, no eject". Schema-aware blocks (data
tables, forms, sidebar, detail views) read your fields and render themselves;
customization is config, and any screen can be forked and passed back in. An
upstream fix is a version bump, not a re-vend across every site.

**6. Composable, not minimal.**
Two UI layers: **primitives** (button, input, card, table, dialog…) and
**blocks** (the table system, the form system, shell, widgets) that compose them
from your config. You think about content, not layout.

**7. Edge-first, but portable.**
Cloudflare (Workers + D1 + R2) is the happy path. Every backend concern sits
behind a small adapter — swap D1 for Postgres or SQLite, R2 for S3 — without
forking anything.

**8. Full-featured underneath.**
Simple at the surface, complete below: i18n, drafts/versions, scheduled publish,
role-based access, media transforms, webhooks, search, audit log, import/export,
live preview, and an MCP server for AI agents.

**9. Open source, MIT, no hosted tier.**
This is a library. There is no SaaS. Pay Cloudflare, not us.

## The promise

```bash
bunx create-content-voila my-site     # fresh TanStack Start app, wired
```

Write your collections in `content.config.ts`, run a migration, and you have a
real admin to edit every collection and singleton — with almost no boilerplate
and no UI code of your own.

→ [Developer Experience](./dx.md) · [Tech Decisions](./tech-decisions.md) · [Roadmap](./roadmap.md)
