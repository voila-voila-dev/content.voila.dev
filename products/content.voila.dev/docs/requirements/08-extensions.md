# 08 — Extensions

"Extension" is not a plugin system with manifests and lifecycles. There are **two seams**: the **Head** (vended TanStack/React code you own) and the **Engine** (Effect `Service`/`Layer` composition). Pick the seam that matches how deep you need to go.

## The two extension seams

| Seam | What you extend | How | Who sees Effect? |
| --- | --- | --- | --- |
| **Head** | Widgets, custom pages, row/bulk/detail actions | `defineWidget` / `definePage` / `defineAction` — vended registry items | Nobody. Pure TanStack + React. |
| **Engine** | DB dialect, storage backend, resolver behaviour, HTTP endpoints, task queue | Provide or wrap a `Layer` for a published `Service` | Only you, opt-in. |

These are additive: 90 % of extensions live entirely in the Head. You reach for `Layer` composition only when you need to intercept mutations, swap adapters, or add server-side endpoints.

## Head extensions — the config surface

```ts
defineContent({
  widgets:  [/* dashboard cards */],
  pages:    [/* custom admin pages */],
  actions:  [/* row/bulk/detail buttons, also definable per-collection */],
  tasks:    [/* invokable background jobs (run via @voila/content) */],
  cron:     [/* scheduled jobs */],
  webhooks: [/* outbound HTTP on events */],
})
```

Everything sidebar-related (panels, navigation entries) is composed from these primitives.

## Widgets — dashboard cards

```ts
import { defineWidget } from '@voila/content-registry'   // vended registry item

const recentSignups = defineWidget({
  id: 'recent-signups',
  title: 'Recent signups',
  size: 'md',                    // 'sm' | 'md' | 'lg' | 'xl'
  icon: 'UserPlus',
  loader: async ({ client }) => client.users.list({
    sort: '-createdAt',
    pageSize: 10,
  }),
  component: ({ data }) => (
    <ul>
      {data.map(u => <li key={u.id}>{u.email}</li>)}
    </ul>
  ),
})

defineContent({ widgets: [recentSignups] })
```

- `loader` calls the typed `@voila/content/client` on the server; result is cached and revalidated by TanStack Query.
- Widget grid is draggable per user; layout persists in `voila_user_prefs`.

## Pages — custom admin routes

```ts
const seoPage = definePage({
  path: '/seo',                  // becomes /admin/seo
  label: 'SEO',
  icon: 'Globe',
  loader: async ({ client }) => ({
    sitemap: await client.posts.count({ filter: { status: 'published' } }),
  }),
  component: SeoPage,
})

defineContent({ pages: [seoPage] })
```

Pages have full access to:

- `client` — `@voila/content/client` (typed, in-process on the server)
- `ctx.user` — current admin user
- `ctx.tasks` — task runner (via `@voila/content`)
- `ctx.storage` — media service

Pages can declare sub-routes via `routes: [...]` (mounted as TanStack Router children).

## Actions — row, bulk, detail "buttons"

Defined on a collection or globally.

```ts
defineCollection({
  slug: 'posts',
  actions: [
    // Per-row button (gear menu)
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: 'CopySimple',
      scope: 'row',
      run: async ({ doc, client }) => {
        return client.posts.create({ ...doc, id: undefined, slug: `${doc.slug}-copy` })
      },
    },

    // Bulk action (header dropdown when items selected)
    {
      id: 'archive-many',
      label: 'Archive selected',
      icon: 'Archive',
      scope: 'bulk',
      confirm: 'Archive %n posts?',
      run: async ({ docs, client }) => {
        await client.posts.updateMany({ ids: docs.map(d => d.id) }, { archived: true })
      },
    },

    // Detail page button (top-right)
    {
      id: 'preview',
      label: 'Preview',
      icon: 'Eye',
      scope: 'detail',
      run: async ({ doc, ctx }) => ctx.redirect(`/preview/${doc.slug}`),
    },
  ],
})
```

`run` can return:

- a doc (admin reloads with the doc)
- `{ toast: 'Done' }`
- `{ redirect: '/path' }`
- `{ open: 'dialog', component: ConfirmDialog, props: {…} }` — open a UI primitive

This covers 99% of "I want a button that does X" without inventing a button DSL.

## Tasks — invokable background jobs

Tasks are the unit of asynchronous work. They run via `@voila/content` — Cloudflare Queues Layer in production, an inline in-process Layer in dev. `input` accepts any `effect/Schema` (which is itself Standard-Schema-compliant):

```ts
import { defineTask } from '@voila/content'
import { Schema } from 'effect'

const translatePost = defineTask({
  id: 'translate-post',
  input: Schema.Struct({ id: Schema.String, to: Schema.Literal('fr', 'it') }),
  retry: { max: 3, backoff: 'exponential' },
  run: async ({ input, client }) => {
    const post = await client.posts.findOne({ id: input.id })
    const translated = await translateWithLLM(post.body, input.to)
    await client.posts.update(post.id, { body: { ...post.body, [input.to]: translated } })
  },
})
```

Invoke from anywhere with full type-safety:

```ts
await ctx.tasks.run('translate-post', { id: post.id, to: 'fr' })
//                                      ^ input is type-checked
```

The admin auto-generates a **Tasks** page listing all registered tasks, with a "Run" form derived from the `input` schema. Operators can trigger any task from the UI.

## Cron — scheduled jobs

```ts
defineContent({
  cron: [
    { id: 'publish-scheduled', schedule: '* * * * *',  task: 'publish-scheduled' },
    { id: 'gc-versions',       schedule: '0 3 * * *',  task: 'gc-versions' },
    { id: 'rebuild-search',    schedule: '0 4 * * 0',  task: 'rebuild-search' },
  ],
})
```

`schedule` is a standard 5-field cron expression. Triggered by Cloudflare Cron Triggers in prod; by an in-process scheduler (inline `@voila/content` Layer) in dev. Adding a cron entry automatically declares the trigger in your `wrangler.jsonc` via `voila migrate` (with confirmation).

Built-in cron jobs (you don't write these):

- `publish-scheduled`: promote `scheduled` → `published`
- `gc-versions`: prune versions past retention
- `gc-trash`: hard-delete trashed docs past retention
- `gc-audit`: prune audit log past retention

## Webhooks — outbound HTTP

```ts
defineContent({
  webhooks: [
    {
      url: 'https://hooks.example.com/voila',
      events: ['posts.create', 'posts.publish', 'posts.update', 'posts.delete'],
      secret: env.WEBHOOK_SECRET,
      headers: { 'X-Source': 'voila' },
    },
  ],
})
```

Payload is signed with `secret` (HMAC-SHA256, `X-Voila-Signature` header). Failed deliveries retry with exponential backoff via the same `@voila/content` infrastructure as tasks.

---

## Engine extensions — `Layer` composition

When Head-level extensions aren't enough, extend the Engine by **providing or wrapping a `Layer`** for a published `Service`. No forking, no source ownership.

```ts
import { defineContent } from '@voila/content'
import { D1Live } from '@voila/content-sql/d1'
import { R2Live } from '@voila/content-storage'
import { MutationService } from '@voila/content'
import { Layer } from 'effect'

export default defineContent({
  collections: [posts, authors],
  database: D1Live({ binding: 'DATABASE' }),      // swap DB = different Layer
  storage:  R2Live({ bucket: 'media' }),

  // Wrap the default MutationService to add audit logging
  layers: [
    Layer.effect(MutationService, auditedMutations),
  ],
})
```

What you can do with `layers: [...]`:

| Want | Layer move |
| --- | --- |
| Swap DB dialect | `TursoLive({…})` instead of `D1Live` |
| Intercept/wrap mutations | `Layer.effect(MutationService, myImpl)` |
| Add HTTP endpoints | `HttpApi.add(voilaApi, myGroup)` in a custom server file |
| Add a custom queue backend | Replace the `@voila/content` Layer |
| Add a custom storage backend | Replace the `@voila/content-storage` Layer |

Effect stays **opt-in**: ignore every seam here and the config is identical to before. The `Layer` seams are public API — semver-stable, documented, testable.

---

## What about… ?

| Want                                       | Use                                        |
| ------------------------------------------ | ------------------------------------------ |
| Add a panel to the sidebar                 | `navigation` entry pointing to a `page`    |
| Add a section inside a doc's detail page   | `detail.layout` + a custom `widget` field  |
| Add a context menu item on a row           | `actions: [{ scope: 'row', … }]`           |
| React to a record changing                 | collection `hooks` OR a `webhook`          |
| Trigger work from outside                  | `POST /admin/api/tasks/:id/run` (auth required) |
| Override a default page (e.g. /media)      | `ui.overrides` (see [07](./07-theming-ui.md)) |
| Swap or wrap a resolver                    | `layers: [Layer.effect(MutationService, …)]` |
| Eject and own the HTTP handler source      | `voila add --eject-server` (power-user flag) |

If you ever feel like you need a generic "lifecycle hook bus", **don't**. Use a task or a webhook.

---

Continue → [09 — Media & Storage](./09-media-storage.md)
