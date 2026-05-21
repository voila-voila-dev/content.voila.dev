# content.voila.dev

> The TanStack-native, edge-first, headless CMS meta-framework.

`content.voila.dev` is a headless CMS that mounts inside your TanStack Start app as a single catch-all route. 
It's not a separate server — it's a library. You define your schema in TypeScript, drop in a route file, and you get a typed admin UI, a REST/RPC API, and an MCP server, all running on Cloudflare.

```ts
// app/routes/admin/$.ts
import { createServerFileRoute } from '@tanstack/react-start/server'
import { content } from '~/content.config'

export const ServerRoute = createServerFileRoute('/admin/$').methods({
  GET:  ({ request }) => content.handle(request),
  POST: ({ request }) => content.handle(request),
})
```

That's the whole integration.

## Why

Most headless CMSes ship as a standalone server. 
That's an extra deploy, an extra auth surface, an extra cache, an extra DX.
TanStack Start already gives you routing, data, forms, mutations, server functions and Cloudflare deploy targets. 
A CMS that belongs **inside** your app.

## Built on

- **TanStack** — Start, Router, Query, Form, Table, DB
- **Cloudflare** — Workers, R2, D1, Queues, Cron
- **shadcn/ui** + **Base UI** primitives + **Tailwind v4** + **Phosphor** icons
- **Drizzle ORM** for DB access (D1, Postgres, SQLite)
- **Better Auth** for sessions, OAuth, magic links, RBAC
- **Zod** for validation
- **Paraglide JS** + **Inlang** for i18n (site + admin)
- **Bun** workspaces

No magic. Plain TypeScript.

## Docs

Start here:

1. [Philosophy](./docs/00-philosophy.md)
2. [Architecture](./docs/01-architecture.md)
3. [Quick Start](./docs/02-quick-start.md)
4. **[Developer Experience](./docs/03-dx.md)** ← read this
5. [Schema & Fields](./docs/04-schema-and-fields.md)
6. [Collections & Singletons](./docs/05-collections-singletons.md)
7. [Configuration](./docs/06-configuration.md)
8. [Theming & Admin UI](./docs/07-theming-ui.md)
9. [Extensions](./docs/08-extensions.md)
10. [Media & Storage](./docs/09-media-storage.md)
11. [API & MCP](./docs/10-api-and-mcp.md)
12. [Deployment](./docs/11-deployment-cloudflare.md)
13. [i18n — Paraglide & Inlang](./docs/13-i18n-paraglide.md)
14. [Roadmap](./docs/12-roadmap.md)

## Status

Planning. This repo currently contains only the design docs. See [`docs/12-roadmap.md`](./docs/12-roadmap.md) for milestones.
