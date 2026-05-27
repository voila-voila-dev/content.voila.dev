# 06 — Configuration

`content.config.ts` lives at the root of your TanStack Start app. It is a plain TypeScript module, imported directly by the vended mount file (`app/server/voila.ts`). See [01 — Architecture](./01-architecture.md#single-integration-point).

`defineContent({...})` composes the default Layer graph from the values you provide and produces a `ManagedRuntime` consumed by the engine handler. Database and storage values are **Layers** — Effect's typed implementation-swapping mechanism. You pick the adapter that matches your target; the engine is unaware of the rest.

## Anatomy

```ts
// content.config.ts
import { defineContent } from '@voila/content'
import { D1Live } from '@voila/content-sql/d1'
import { R2Live } from '@voila/content-storage'

import { posts, authors } from './content/collections'
import { siteSettings } from './content/singletons'
import { extensions } from './content/extensions'

export default defineContent({

  // ── Identity ───────────────────────────────────────────────────────────
  branding: {
    name: 'Acme CMS',
    logo: '/logo.svg',                   // light mode
    logoDark: '/logo-dark.svg',
    favicon: '/favicon.ico',
    accent: '#FF6A00',                   // overrides --voila-color-accent
  },

  // ── Mounting ───────────────────────────────────────────────────────────
  mount: {
    admin: '/admin',                     // where the admin SPA lives
    api:   '/admin/api',                 // where REST lives
    mcp:   '/admin/mcp',                 // where the MCP server lives
  },

  // ── Schema ─────────────────────────────────────────────────────────────
  collections: [posts, authors],
  singletons:  [siteSettings],

  // ── Adapters (Layers) ──────────────────────────────────────────────────
  database: D1Live({ binding: 'DATABASE' }),              // a Layer
  storage:  R2Live({ bucket: 'media', publicUrl: 'https://media.acme.com' }), // a Layer

  // ── Auth ───────────────────────────────────────────────────────────────
  auth: {
    providers: ['email', 'github'],
    sessionTtl: '7d',
    roles: ['admin', 'editor', 'viewer'] as const,
  },

  // ── Localization ───────────────────────────────────────────────────────
  // See 13-i18n-paraglide.md for the full model (three pillars).
  // Locales are BCP 47 tags constrained to the static `Locale` union
  // generated from CLDR — typos (e.g. 'fr-Fr', 'en-us') fail at typecheck.
  i18n: {
    locales: ['en-US', 'fr-FR', 'it-IT'] as const,
    defaultLocale: 'en-US',
    fallback: { 'fr-FR': ['en-US'], 'it-IT': ['en-US'] },

    // Pillar 3 — static site UI strings managed in the built-in Messages
    // section, synced with disk files via `voila i18n pull / push`.
    // Omit to disable disk sync (Messages still works in the admin).
    messages: {
      dir:        './messages',
      project:    './project.inlang',
      namespaces: ['ui', 'forms', 'errors', 'marketing'],
    },
  },

  // ── Navigation ─────────────────────────────────────────────────────────
  navigation: [
    { label: 'Dashboard', icon: 'House', to: '/' },
    {
      label: 'Content',
      icon: 'Stack',
      items: [
        { collection: 'posts' },
        { collection: 'authors' },
      ],
    },
    {
      label: 'Marketing',
      icon: 'Megaphone',
      items: [
        { singleton: 'site-settings' },
        { page: '/seo' },
      ],
    },
    { label: 'Media',    icon: 'Image',     to: '/media' },
    { label: 'Messages', icon: 'Translate', to: '/messages' },
  ],

  // ── Extensions (see 08) ────────────────────────────────────────────────
  ...extensions,

  // ── Power-user Layer overrides ─────────────────────────────────────────
  // Provide additional Layers to wrap or replace any engine Service.
  // Ignored by most users — see "Layer escape hatch" below.
  // layers: [Layer.effect(MutationService, auditedMutations)],

  // ── Retention ──────────────────────────────────────────────────────────
  retention: {
    versionDays: 90,
    trashDays:   30,
    auditDays:   365,
  },

  // ── Webhooks ───────────────────────────────────────────────────────────
  webhooks: [
    {
      url: 'https://hooks.example.com/voila',
      events: ['posts.publish', 'posts.update'],
      secret: process.env.WEBHOOK_SECRET,
    },
  ],

  // ── MCP ────────────────────────────────────────────────────────────────
  mcp: {
    enabled: true,
    auth: 'bearer',                      // 'bearer' | 'oauth' | 'none'
  },
})
```

## Database

`database` accepts a **Layer** that provides the `Database` Service. Pick the one that matches your target:

| Import | Target |
| --- | --- |
| `D1Live` from `@voila/content-sql/d1` | Cloudflare D1 (production + `wrangler dev`) |
| `PgLive` from `@voila/content-sql/pg` | Postgres (Neon, Supabase, local) |
| `SqliteLive` from `@voila/content-sql/sqlite` | SQLite via Bun (local dev, CI) |

```ts
import { D1Live }     from '@voila/content-sql/d1'
import { PgLive }     from '@voila/content-sql/pg'
import { SqliteLive } from '@voila/content-sql/sqlite'

// Cloudflare D1 — binding name from wrangler.jsonc
database: D1Live({ binding: 'DATABASE' })

// Postgres
database: PgLive({ url: env.DATABASE_URL })

// Local SQLite (useful in CI or non-CF local dev)
database: SqliteLive({ filename: '.voila/dev.db' })
```

Swapping DB = swapping one Line. The engine never changes.

## Storage

`storage` accepts a **Layer** that provides the `Storage` Service:

```ts
import { R2Live } from '@voila/content-storage'
import { S3Live } from '@voila/content-storage'

// Cloudflare R2
storage: R2Live({ bucket: 'media', publicUrl: 'https://media.acme.com' })

// S3-compatible (AWS, MinIO, Tigris)
storage: S3Live({ bucket: 'media', region: 'us-east-1' })
```

## Branding

`branding` is the only thing that maps to user-visible identity:

| Key         | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| `name`      | Shown in sidebar header, browser tab, emails                   |
| `logo`      | Sidebar logo (light)                                           |
| `logoDark`  | Sidebar logo (dark)                                            |
| `favicon`   | Browser favicon                                                |
| `accent`    | Sets `--voila-color-accent`; everything else follows the token |
| `footer`    | Custom footer line in the sidebar                              |

For deeper visual customization see [07 — Theming](./07-theming-ui.md).

## Navigation

Navigation is **declarative**. Each entry is one of:

- `{ collection: 'posts' }` — link to a collection's list view
- `{ singleton: 'site-settings' }` — link to a singleton's edit page
- `{ page: '/seo' }` — link to a custom page registered via `pages`
- `{ to: '/media' }` — link to a built-in admin page
- `{ label, icon, items: [...] }` — a group (no link, just collapsible header)

The sidebar order is the array order. Groups can be one level deep (no nested groups).

If you omit `navigation`, the admin generates a default from your collections/singletons grouped by `admin.group`.

## Auth

Auth is powered by [Better Auth](https://www.better-auth.com/). Email magic-link + GitHub OAuth are wired in by default; the `auth` block in `content.config.ts` is a thin facade that compiles down to a Better Auth instance sharing the same database Layer.

To add a provider, drop in any Better Auth social provider:

```ts
auth: {
  providers: [
    'email',
    {
      google: {
        clientId:     env.GOOGLE_ID,
        clientSecret: env.GOOGLE_SECRET,
      },
    },
  ],
  sessionTtl: '7d',
  roles: ['admin', 'editor', 'viewer'] as const,
}
```

Anything Better Auth supports (passkeys, 2FA, organizations, magic link, OIDC) is reachable via `auth.betterAuth` for escape-hatch config. Roles are an `as const` tuple, surfaced as a TypeScript union for `access` callbacks.

## Layer escape hatch

For power users who want to wrap or replace an engine Service without owning the engine source, `defineContent` accepts a `layers` array:

```ts
import { Layer } from 'effect'
import { MutationService } from '@voila/content'

defineContent({
  // … other config …
  database: TursoLive({ url }),                              // different dialect Layer
  layers: [
    Layer.effect(MutationService, auditedMutations),         // wrap the default resolver
  ],
})
```

`layers` are merged into the runtime after the defaults — they can wrap, override, or extend any `Service` the engine exposes. If you never touch this key, it does not exist from your perspective. The engine upgrades via `npm update` either way.

## Environment & secrets

`content.config.ts` runs on the worker. Read secrets through:

```ts
import { env } from 'cloudflare:workers'
// or for Node/Bun:
import { env } from '@voila/content/env'
```

Never hard-code secrets in `content.config.ts`. They're committed to git.

## Multi-tenancy

A common ask. Two patterns:

1. **One config, tenant-scoped queries**: add `tenantId` field to every collection and inject `tenantId` into `ctx` via `auth.session`. Use `access.read/write` to enforce.
2. **Many configs, one worker**: export multiple configs, dispatch by hostname in your route handler.

We document (1); we support (2) without ceremony.

---

Continue → [07 — Theming & Admin UI](./07-theming-ui.md)
