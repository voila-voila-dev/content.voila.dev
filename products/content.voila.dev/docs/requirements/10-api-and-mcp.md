# 10 — API & MCP

`content.voila.dev` exposes your content through three surfaces, all derived from the same schema:

1. **REST/RPC** — for browsers, mobile, anything that speaks HTTP.
2. **Typed client** — for your TanStack Start app & other TS consumers.
3. **MCP** — for AI agents (Claude Desktop, Claude Code, Cursor, your own).

All three enforce the same RBAC, the same validation, the same hooks.

---

## REST API

Mounted under `mount.api` (default: `/admin/api`) as virtual server file
routes contributed by the `@voila/content/vite` plugin. The same
operations are also available as TanStack Start `createServerFn` calls
for typed in-process invocation from the admin and the consumer's site
code — REST is the transport, server functions are the typed entry.

### Conventions

```
GET    /:collection                  list, with filters/sort/pagination
GET    /:collection/:id              find by id
GET    /:collection?slug=…           find by any unique field
POST   /:collection                  create
PATCH  /:collection/:id              partial update
PUT    /:collection/:id              full update
DELETE /:collection/:id              delete (soft if trash:true)

GET    /singletons/:slug             read a singleton
PUT    /singletons/:slug             write a singleton

POST   /media/presign                request presigned upload
POST   /media                        record an uploaded object
GET    /media/:id                    media metadata
DELETE /media/:id                    delete an object

POST   /tasks/:id/run                run a registered task

POST   /auth/login
POST   /auth/logout
GET    /auth/me
```

### Query DSL

List endpoints accept:

```
?filter[status]=published
?filter[publishedAt][gte]=2026-01-01
?filter[tags][in]=news,dev
?sort=-publishedAt
?page=2&pageSize=25
?include=author,tags
?fields=title,slug,publishedAt
?locale=fr
?q=hello+world           (full-text search)
?status=draft            (requires auth + permission)
```

Bracket syntax is parsed deterministically (`qs`-style) and mapped to Drizzle WHERE clauses.

### Response shape

```json
{
  "data": [/* docs */],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 142,
    "hasMore": true
  }
}
```

For singletons: `{ "data": { … } }`.

For errors: RFC 7807 `application/problem+json`:

```json
{
  "type": "/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "errors": [
    { "path": "title", "message": "Required" }
  ]
}
```

### Auth

Auth is handled by [Better Auth](https://www.better-auth.com/) — see [06 — Configuration](./06-configuration.md#auth).

- **Session cookie** for the admin UI (HttpOnly, SameSite=Lax), issued by Better Auth.
- **Bearer token** for programmatic access: `Authorization: Bearer <key>`.
- API keys are managed in the admin under Settings → API Keys; scoped per collection and per verb.

---

## Typed client

```bash
bun add @voila/client
```

```ts
// app/lib/content.ts
import { createClient } from '@voila/client'
import type config from '~/content.config'

export const content = createClient<typeof config>({
  baseUrl: import.meta.env.VITE_CONTENT_URL ?? '/admin/api',
})
```

Then anywhere:

```ts
const posts = await content.posts.list({
  filter: { status: 'published', tags: { in: ['news'] } },
  sort:   '-publishedAt',
  pageSize: 10,
  include: ['author'],
})

const post = await content.posts.findOne({ slug: 'hello' })

const created = await content.posts.create({ title: 'Hi', body: { html: '<p>…</p>' } })

const settings = await content.singletons.siteSettings.get()
```

Every method signature is inferred from `typeof config`. Renaming a field updates the client. No build step.

### React (TanStack Query)

```ts
import { content } from '~/lib/content'
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['posts', { slug }],
  queryFn: () => content.posts.findOne({ slug }),
})
```

For a fuller integration, `@voila/client/react` ships helpers that produce typed query keys & options:

```ts
import { contentQueries } from '@voila/client/react'

useQuery(contentQueries.posts.findOne({ slug }))
```

### SSR & loaders

Server-side, prefer the **server client** (skips HTTP, calls handlers directly):

```ts
// in a server function / loader
import { server } from '~/lib/content.server'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => server.posts.findOne({ slug: params.slug }),
})
```

`server` and `content` have identical types but the server one is in-process.

---

## MCP server

Mounted under `mount.mcp` (default: `/admin/mcp`). Implements the [Model Context Protocol](https://modelcontextprotocol.io) over HTTP+JSON-RPC.

### Tools (one per write operation)

Every collection emits a set of tools, derived from the schema:

```
posts.list           input: { filter?, sort?, pageSize?, page? }
posts.find           input: { id?: string, slug?: string }
posts.create         input: <inferred from fields>
posts.update         input: { id, patch: <partial fields> }
posts.delete         input: { id }
posts.publish        input: { id, at?: string }   (if drafts/scheduled enabled)
```

Same for singletons:

```
singletons.siteSettings.get
singletons.siteSettings.update
```

Plus introspection tools:

```
schema.list          → list of collections + singletons
schema.describe      input: { slug } → JSON schema of fields
```

And task invocation:

```
tasks.run            input: { id, args: <inferred per task> }
tasks.list           → list of available tasks
```

### Resources

```
voila://schema                       full config JSON schema
voila://collections/:slug            schema of a collection
voila://docs/:collection/:id         a specific document
voila://media/:id                    media metadata
```

Resources are read-only; tools are how agents mutate.

### Prompts

A few starter prompts are registered, e.g. `voila.write-post`, `voila.translate-doc`. Authors can add their own under `mcp.prompts` in the config.

### Auth

`mcp.auth: 'bearer'` requires an API key (same keys as REST). `mcp.auth: 'oauth'` uses an OAuth 2.1 flow (PKCE) — the default for hosted Claude/Cursor connectors.

### Standalone server

If you want to expose MCP to clients that don't speak HTTP+OAuth (Claude Desktop), run:

```bash
bunx voila mcp --config ./content.config.ts --transport stdio
```

It boots the same server, just over stdio.

### Why MCP matters here

A headless CMS is a *content database with a UI*. The UI gives humans direct access; MCP gives AI agents direct, auth-scoped, type-checked access. Agents become a first-class client class — same RBAC, same validation, same hooks. They can:

- draft content into your CMS (`posts.create({ status: 'draft' })`)
- run tasks (translation, regeneration, bulk edits)
- read the schema to know what fields exist and what's valid

Without us doing anything extra, because the schema is the program.

---

## OpenAPI

`GET /admin/api/__openapi.json` returns an OpenAPI 3.1 document derived from the schema. Use it for generating clients in non-TS languages, or for hooking up Swagger UI.

---

Continue → [11 — Deployment](./11-deployment-cloudflare.md)
