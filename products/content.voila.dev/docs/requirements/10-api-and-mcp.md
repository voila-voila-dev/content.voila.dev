# 10 — API & MCP

`content.voila.dev` exposes your content through three surfaces, all derived from a **single `HttpApi` definition**:

1. **REST** — for browsers, mobile, anything that speaks HTTP.
2. **Typed client** — for your TanStack Start app & other TS consumers.
3. **MCP** — for AI agents (Claude Desktop, Claude Code, Cursor, your own).

All three enforce the same RBAC, the same validation, the same hooks.

---

## The `HttpApi` definition

`@voila/content/server` owns **one `HttpApi`** (`@effect/platform`). From it three artifacts are derived for free:

| Artifact | How | Package |
| --- | --- | --- |
| Server handlers | `HttpApiBuilder` — mounted by the vended server file | `@voila/content/server` |
| Typed client | `HttpApiClient` | `@voila/content/client` |
| OpenAPI document | `OpenApi.fromApi` | served at `GET /admin/api/__openapi.json` |

Request and response schemas are `effect/Schema` objects reused from `@voila/content-schema`. You never maintain client types or OpenAPI by hand.

---

## REST API

Mounted under `mount.api` (default: `/admin/api`) by the vended server route file (`app/server/voila.ts`). The `HttpApi` definition structures its endpoints as one `HttpApiGroup` per collection and one group each for singletons, media, tasks, and auth.

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

POST   /media/presign                request presigned upload URL
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

Bracket syntax is parsed deterministically (`qs`-style) and compiled to typed SQL by `@voila/content-sql`.

### Response envelope

```json
{ "data": [/* docs */], "nextCursor": "…" }
```

For singletons: `{ "data": { … } }`.

Typed Effect errors (`HttpApiError` + domain errors) are mapped to the error envelope:

```json
{ "error": { "code": "VALIDATION", "fields": [{ "path": "title", "message": "Required" }] } }
```

HTTP status codes follow from the typed error: `404 NOT_FOUND`, `422 VALIDATION`, `401 UNAUTHORIZED`, `409 CONFLICT`, etc.

### Auth & middleware

Auth is handled by [Better Auth](https://www.better-auth.com/) bridged as an `@voila/content-auth` Layer — see [06 — Configuration](./06-configuration.md#auth).

- **Session cookie** for the admin UI (HttpOnly, SameSite=Lax), issued by Better Auth.
- **Bearer token** for programmatic access: `Authorization: Bearer <key>`.
- API keys are managed in the admin under Settings → API Keys; scoped per collection and per verb.

CSRF (HMAC double-submit) and session enforcement are `HttpApiMiddleware` attached to the `HttpApi` definition — not ad-hoc middleware in each handler.

---

## Typed client

```bash
bun add @voila/content/client
```

`@voila/content/client` is derived from the same `HttpApi` definition via `HttpApiClient`. It ships as a ready-to-use typed client — no separate codegen step.

```ts
// app/lib/content.ts
import { createClient } from '@voila/content/client'
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

`@voila/content/client/react` ships helpers that produce typed query keys & options:

```ts
import { contentQueries } from '@voila/content/client/react'

useQuery(contentQueries.posts.findOne({ slug }))
```

### SSR & loaders

Server-side, prefer the **in-process client** (calls engine Services directly, skips HTTP):

```ts
// in a TanStack Start server function / loader
import { server } from '~/lib/content.server'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => server.posts.findOne({ slug: params.slug }),
})
```

`server` and `content` have identical types — `server` is a thin wrapper that calls the `HttpApi` handlers in-process via the engine's `ManagedRuntime` rather than over the network.

> **Note on mutation path:** the typed-mutation path uses the `HttpApi` client (both over HTTP and in-process) as the default. `@effect/rpc` is available as an optional separate RPC channel if a team needs it — this is a deferred decision, not a default.

---

## MCP server

`@voila/content-mcp` is generated from the `@voila/content-schema` types and `@voila/content/server`'s `HttpApi` definition (+ the OpenAPI document it emits). It runs HTTP+JSON-RPC and stdio transports from the same code.

Mounted under `mount.mcp` (default: `/admin/mcp`). Implements the [Model Context Protocol](https://modelcontextprotocol.io).

### Tools (one per write operation)

Every collection emits a set of tools, derived from the schema:

```
posts.list           input: { filter?, sort?, pageSize?, page? }
posts.find           input: { id?: string, slug?: string }
posts.create         input: <inferred from effect/Schema fields>
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

A headless CMS is a *content database with a UI*. The UI gives humans direct access; MCP gives AI agents direct, auth-scoped, type-checked access. Because MCP is generated from the same `HttpApi` and `effect/Schema` definitions as the REST API, agents become a first-class client class — same RBAC, same validation, same hooks. They can:

- draft content into your CMS (`posts.create({ status: 'draft' })`)
- run tasks (translation, regeneration, bulk edits)
- read the schema to know what fields exist and what's valid

Without us doing anything extra, because the schema is the program.

---

## OpenAPI

`GET /admin/api/__openapi.json` returns an OpenAPI 3.1 document generated by `OpenApi.fromApi` over the engine's `HttpApi` definition. Use it for generating clients in non-TS languages, or for hooking up Swagger UI. The document stays in sync with the schema automatically — no manual maintenance.

---

Continue → [11 — Deployment](./11-deployment-cloudflare.md)
