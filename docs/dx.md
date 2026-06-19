# Developer Experience

> The most important doc. Every other decision is downstream of *what does it
> feel like to use?*

**North star:** a developer who knows TanStack scaffolds a production CMS for a
real product in **one afternoon**, writing almost no UI code and learning no new
concepts. If a release breaks that, we cut features, not the north star.

## The whole app

A fresh TanStack Start app needs three things from you: a config, a one-line
mount, and the vended admin shell. That's the boilerplate.

```ts
// content.config.ts — the one file you maintain
import { defineConfig, defineCollection, defineSingleton, fields } from "@voila/content"

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true, max: 120 }),
    slug:  fields.slug({ from: "title" }),
    body:  fields.richText(),
    cover: fields.media({ accept: ["image/*"] }),
    tags:  fields.array(fields.string()),
    publishedAt: fields.datetime(),
  },
  list: { columns: ["title", "publishedAt", "tags"] },
})

const settings = defineSingleton({
  slug: "settings",
  fields: { siteName: fields.string({ localized: true }) },
})

export default defineConfig({
  branding: { name: "Acme" },
  collections: { posts },
  singletons: { settings },
})
```

```bash
voila add admin           # vends the admin shell + routes into app/ (you own them)
voila migrate generate    # DDL from your fields
voila migrate apply       # apply to SQLite / D1 / Postgres
bun dev                   # → http://localhost:3000/admin
```

That's it. You now have list views, detail editors, create/edit forms, a
sidebar, and auth — for **every** collection and singleton — and you wrote zero
table columns and zero form fields.

## Auth & security (secure by default)

A scaffolded app ships **locked down**, not open. The `/admin/api` mount is wired
with all three protections out of the box (`app/lib/server.ts`):

- **Authentication** — magic-link sign-in (Better Auth). Every content request
  must carry a valid session or it's a `401`. `GET /admin/*` is guarded too: a
  signed-out visitor is redirected to `/admin/login` before any UI renders.
- **CSRF** — a signed double-submit token. Mutating requests (`POST/PATCH/
  DELETE`) without a valid `x-csrf-token` are `403`. The typed client mirrors the
  `voila_csrf` cookie into the header automatically; you don't manage it.
- **Access control** — **first-user-wins**: the first account to complete
  sign-in claims the admin. Any later email can authenticate but is denied
  (`403`) on every collection. No allowlist to maintain.

```bash
# .env (create-voila writes one with a generated secret; .env is git-ignored)
VOILA_AUTH_SECRET=…        # signs sessions, magic-link tokens, and the CSRF token
VOILA_BASE_URL=http://localhost:3000
# RESEND_API_KEY + VOILA_AUTH_FROM → real email; otherwise links print to the terminal
```

In dev, magic links are printed to the server terminal (`[voila/auth] magic
link …`) — no mail provider needed. Set `RESEND_API_KEY` and `VOILA_AUTH_FROM`
to send real email in production. `voila migrate generate --auth` (the default
`migrate:generate` script) provisions the Better Auth tables alongside your
content tables.

**Threat model.** The session cookie is `HttpOnly` + `SameSite=Lax`, which alone
blocks cross-site state-changing requests; the signed CSRF token is defense in
depth. The real security boundary is the REST mount (`auth` + `csrf` + `access`)
— the login page and route guard are UX on top of it. To harden further: swap
first-user-wins for a real RBAC policy (the `access` hook takes any predicate),
move secrets to your platform's secret store, and serve over HTTPS so cookies
are `Secure`. To open a read-only public API, mount a second handler without
`auth` on a different path — never by dropping `auth` from the admin mount.

## Why you write so little UI

Two UI packages do the composition for you:

| Package | What it is | Examples |
| --- | --- | --- |
| **`@voila/ui`** | Styled primitives (shadcn-on-Base-UI) | `Button`, `Input`, `Select`, `Card`, `Table`, `Dialog`, `Sidebar`, `Toast` |
| **`@voila/content-ui`** | Schema-aware blocks that read your config | `DataTable`, `CollectionForm`, `FieldRenderer`, `AdminShell`, `ListView`, `DetailView`, dashboard widgets |

A `DataTable` builds its columns and cells from a collection's `list.columns` +
field metadata. A `CollectionForm` builds its inputs from the field kinds and
validates against each field's Standard Schema. You compose blocks; they read the
config. Need a one-off? Drop to primitives — they're in the same repo, yours to
edit.

## Type inference, never codegen

Types come from `defineConfig` inference — no `voila generate`, no file watcher.

```ts
import type { InferDoc } from "@voila/content"
type Post = InferDoc<typeof config, "posts">
//   ^ { title: string; slug: string; body: RichTextValue; tags: readonly string[]; … }
```

The typed client is inferred from the same config: `client.posts.findOne(...)`
autocompletes and `post.title` is `string`. No sync step.

## The CLI is short

```
voila add <item>          vend a registry item into your repo (admin, blocks, fields)
voila diff [item]         show drift between your copy and upstream
voila list                browse the catalog

voila migrate generate    SQL from your field definitions
voila migrate apply       --target sqlite | d1 | postgres
voila seed                run seed scripts
voila mcp                 run the MCP server
voila doctor              sanity-check config, env, bindings
```

No `voila plugin add`, no `voila page new`. Extensions are TypeScript imports.

## Escape hatches (you never get stuck)

- **Own the files.** `voila add` vends real source. Edit, restyle, re-path — it's
  your code, greppable and PR-diffable.
- **Custom widget:** `fields.string({ widget: ColorPicker })` — a React component
  receiving `{ value, onChange, error, field }`.
- **Custom page / dashboard widget / row action:** registered in the config.
- **Swap a backend:** pass a different database/storage adapter to `defineConfig`.
- **Custom rich text:** `@voila/rich-text-editor` (Plate) — add plugins or
  override any node component without forking.

## Errors are actionable

Every error names the field, the cause, and the fix — never a bare stack trace.

```
[voila] Field "posts.body" needs a richText editor adapter.
  Cause: plugins: ["mention"] set, but no mention adapter registered.
  Fix:   richText({ plugins: [mention({ source: "users" })] })
```

## The afternoon test

Graded on a clean install, by someone who knows TanStack but not voila:

| Scenario | Budget |
| --- | --- |
| New collection with 6 fields, running locally | 3 min |
| Add a `color` field, see it in the admin | 1 min |
| Restyle the sidebar logo & accent | 2 min |
| Custom dashboard widget | 5 min |
| Deploy to Cloudflare with D1 + R2 | 10 min |

Slip any budget on a clean install and it's a release blocker.

→ [Philosophy](./philosophy.md) · [Tech Decisions](./tech-decisions.md) · [Roadmap](./roadmap.md)
