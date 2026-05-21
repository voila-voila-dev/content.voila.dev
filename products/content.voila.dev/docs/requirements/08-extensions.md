# 08 — Extensions

"Extension" is not a plugin system with manifests and lifecycles. An extension is an object you put in your config. There are six kinds; all are optional.

## The extension surface

```ts
defineContent({
  widgets:    [/* dashboard widgets */],
  pages:      [/* custom admin pages */],
  actions:    [/* row/bulk/detail buttons (also definable per-collection) */],
  tasks:      [/* invokable background jobs */],
  cron:       [/* scheduled jobs */],
  webhooks:   [/* outbound HTTP on events */],
})
```

Everything else (sidebar entries, panels, etc.) is composed from these primitives.

## Widgets — dashboard cards

```ts
import { defineWidget } from '@voila/content'

const recentSignups = defineWidget({
  id: 'recent-signups',
  title: 'Recent signups',
  size: 'md',                    // 'sm' | 'md' | 'lg' | 'xl'
  icon: 'UserPlus',
  loader: async ({ ctx }) => ctx.database.users.find({
    orderBy: { createdAt: 'desc' },
    limit: 10,
  }),
  component: ({ data }) => (
    <ul>
      {data.map(u => <li key={u.id}>{u.email}</li>)}
    </ul>
  ),
})

defineContent({ widgets: [recentSignups] })
```

- `loader` runs on the server (via TanStack Query under the hood); result is cached and revalidated.
- Widget grid is draggable per user; layout persists in `voila_user_prefs`.

## Pages — custom admin routes

```ts
const seoPage = definePage({
  path: '/seo',                  // becomes /admin/seo
  label: 'SEO',
  icon: 'Globe',
  loader: async ({ ctx }) => ({
    sitemap: await ctx.database.posts.count({ status: 'published' }),
  }),
  component: SeoPage,
})

defineContent({ pages: [seoPage] })
```

Pages have full access to:

- `ctx.database` — typed database client (same schema as the admin)
- `ctx.user` — current admin user
- `ctx.tasks` — task runner
- `ctx.storage` — media adapter

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
      run: async ({ doc, ctx }) => {
        return ctx.database.posts.create({ ...doc, id: undefined, slug: `${doc.slug}-copy` })
      },
    },

    // Bulk action (header dropdown when items selected)
    {
      id: 'archive-many',
      label: 'Archive selected',
      icon: 'Archive',
      scope: 'bulk',
      confirm: 'Archive %n posts?',
      run: async ({ docs, ctx }) => {
        await ctx.database.posts.update({ id: { in: docs.map(d => d.id) } }, { archived: true })
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

Tasks are the unit of asynchronous work. They run on Cloudflare Queues in production, on a worker thread in dev.

`input` accepts any [Standard Schema](https://standardschema.dev/) validator — Zod is shown here, but Valibot, ArkType, etc. work identically.

```ts
import { defineTask } from '@voila/content'
import { z } from 'zod'

const translatePost = defineTask({
  id: 'translate-post',
  input: z.object({ id: z.string(), to: z.enum(['fr', 'it']) }),
  retry: { max: 3, backoff: 'exponential' },
  run: async ({ input, ctx }) => {
    const post = await ctx.database.posts.findOne({ id: input.id })
    const translated = await translateWithLLM(post.body, input.to)
    await ctx.database.posts.update({ id: post.id }, { body: { ...post.body, [input.to]: translated } })
  },
})
```

Invoke from anywhere with full type-safety:

```ts
await ctx.tasks.run('translate-post', { id: post.id, to: 'fr' })
//                                      ^ input is type-checked
```

The admin auto-generates a "Tasks" page listing all registered tasks, with a "Run" form derived from the `input` schema. Operators can trigger any task from the UI.

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

`schedule` is a standard 5-field cron expression. Triggered by Cloudflare Cron Triggers in prod; by an in-process scheduler in dev. Adding a cron entry automatically declares the trigger in your `wrangler.jsonc` via `voila migrate` (with confirmation).

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

Payload is signed with `secret` (HMAC-SHA256, `X-Voila-Signature` header). Failed deliveries retry with exponential backoff via the same Queue infra as tasks.

## What about… ?

| Want                                       | Use                                        |
| ------------------------------------------ | ------------------------------------------ |
| Add a panel to the sidebar                 | `navigation` entry pointing to a `page`    |
| Add a section inside a doc's detail page   | `detail.layout` + a custom `widget` field  |
| Add a context menu item on a row           | `actions: [{ scope: 'row', … }]`           |
| React to a record changing                 | collection `hooks` OR a `webhook`          |
| Trigger work from outside                  | `POST /api/tasks/:id/run` (auth required)  |
| Override a default page (e.g. /media)      | `ui.overrides` (see [07](./07-theming-ui.md)) |

If you ever feel like you need a generic "lifecycle hook bus", **don't**. We hit that complexity ceiling on purpose. Use a task or a webhook.

---

Continue → [09 — Media & Storage](./09-media-storage.md)
