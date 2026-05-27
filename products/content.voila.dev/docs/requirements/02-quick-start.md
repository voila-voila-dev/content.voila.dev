# 02 — Quick Start

There are two ways to get started:

- **A. Scaffold from the template** — fastest path, you get a working site + admin in one command. Best for new projects.
- **B. Add to an existing TanStack Start app** — `voila init` then `voila add` to vend the admin into your repo. Best if you already have a Start app you don't want to throw away.

Pick A if you're exploring. Pick B if you're integrating.

---

## A. From the template (recommended)

One command clones the minimal example from the [content.voila.dev repo](https://github.com/voila-dev/content.voila.dev) (kept in sync with the latest package versions on every release), installs deps, and runs the first migration:

```bash
bunx create-voila@latest my-site
cd my-site
bun dev
```

Open `http://localhost:3000/admin`. The first-run wizard creates your admin user. Skip ahead to [§3 Define your content](#3-define-your-content) — everything from here on is the same.

What you get out of the box:

- TanStack Start + Cloudflare adapter
- `content.config.ts` with a starter `posts` collection
- `app/server/voila.ts` — a thin mount file wiring the engine to your route tree (real file, yours to edit)
- `app/routes/admin/$.tsx` and the admin shell — vended, real files
- `@voila/ui` theme tokens wired into `app/styles/globals.voila.css`
- `wrangler.jsonc` pre-configured with D1 + R2 bindings (commented, opt-in)
- Better Auth set up with email magic-link (Resend) and a GitHub OAuth stub

> The template tracks the latest `@voila/*` package versions and Better Auth release. Re-run `bunx create-voila@latest` against an empty dir to see the current set.

---

## B. Add to an existing project

Already have a TanStack Start app? Install the engine packages, write your config, then use the registry CLI to vend the admin files into your `app/`.

### 1. Create a TanStack Start app (skip if you already have one)

```bash
bunx create-tsr@latest my-site --template start-cloudflare
cd my-site
```

### 2. Install the engine packages

```bash
bun add @voila/content @voila/content-sql/d1 @voila/content-storage @voila/ui
bun add -d @voila/content-cli
```

`@voila/content` is the umbrella that composes the default Layer graph. `@voila/content-sql/d1` provides the Cloudflare D1 database Layer; swap in `@voila/content-sql/pg` or `@voila/content-sql/sqlite` for other targets.

### 3. Write `content.config.ts`

See [§3 Define your content](#3-define-your-content) below. The config composes Layers for your database and storage adapters.

### 4. Vend the admin files with the registry CLI

```bash
bunx voila add admin-shell
```

`voila add` resolves registry dependencies, copies real source files into your `app/`, and installs any additional npm packages they need. No virtual routes, no vite plugin magic — what you get are ordinary TanStack Start route files you own and can edit.

After running, your `app/` will contain:

```
app/
  server/voila.ts          # thin mount file — yours to add middleware to
  routes/admin/$.tsx       # admin catch-all route
  components/admin/        # shell, sidebar, layout
```

Prefer to see exactly what will be added first? `voila list` shows the full catalog; `voila diff` shows drift between your copy and upstream.

---

## 3. Define your content

```ts
// content.config.ts (project root)
import { defineContent, defineCollection, fields } from '@voila/content'
import { D1Live } from '@voila/content-sql/d1'
import { R2Live } from '@voila/content-storage'

const posts = defineCollection({
  slug: 'posts',
  label: 'Posts',
  icon: 'NewspaperClipping',
  fields: {
    title:       fields.string({ required: true, max: 120 }),
    slug:        fields.slug({ from: 'title' }),
    body:        fields.richText(),
    cover:       fields.media({ accept: ['image/*'] }),
    tags:        fields.array(fields.string()),
    publishedAt: fields.datetime(),
  },
  list: { columns: ['title', 'publishedAt', 'tags'] },
})

export default defineContent({
  branding:    { name: 'My Site', logo: '/logo.svg' },
  collections: [posts],
  database:    D1Live({ binding: 'DATABASE' }),   // a Layer
  storage:     R2Live({ bucket: 'media' }),        // a Layer
})
```

The vended mount file is three lines — import the engine handler, your config, and re-export:

```ts
// app/server/voila.ts — VENDED, you own this
import { makeHandler } from '@voila/content/server'
import config from '~/content.config'

export const voilaHandler = makeHandler(config)  // add middleware here
```

This file is yours. Add auth guards, rate limiting, or extra routes right here. The handler logic stays in the `@voila/content/server` dependency and ships upgrades via `npm update`.

## 4. Run migrations & dev

```bash
bunx voila migrate generate   # generate SQL from your field definitions
bunx voila migrate apply      # apply to local SQLite (or D1 with --target d1-local)
bun dev
```

Open `http://localhost:3000/admin`. First-run wizard creates your admin user.

## 5. Use your content

In your public TanStack Start routes:

```tsx
// app/routes/blog/$slug.tsx
import { createFileRoute } from '@tanstack/react-router'
import { client } from '~/content.client'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => client.posts.findOne({ slug: params.slug }),
  component: ({ loaderData: post }) => (
    <article>
      <h1>{post.title}</h1>
      <img src={post.cover.url} />
      <div dangerouslySetInnerHTML={{ __html: post.body.html }} />
    </article>
  ),
})
```

The `client` is fully typed from your `content.config.ts`. Autocomplete on `client.posts.*` works. `post.title` is `string`. No codegen.

## What just happened

- `voila add` vended real TanStack Start route files — greppable, debuggable, yours.
- The thin mount file (`app/server/voila.ts`) owns the mount point; the engine handles all request logic.
- The DB schema is derived from your field definitions (via `effect/Schema` annotations); `voila migrate` drives the DDL.
- The public client (`@voila/content/client`) is derived from the same `HttpApi` definition as the server — one source of truth, typed end-to-end.
- Media uploads go to R2; URLs are signed when needed.

---

## Manual install

If you want to know exactly what each step touches (or you're integrating into a non-standard layout):

1. **Install packages**

   ```bash
   bun add @voila/content @voila/content-sql/d1 @voila/content-storage @voila/ui better-auth
   bun add -d @voila/content-cli
   ```

   Swap `@voila/content-sql/d1` for `@voila/content-sql/pg` (Postgres) or `@voila/content-sql/sqlite` (local Bun/Node).

2. **Create `content.config.ts`** at the project root — see [§3 Define your content](#3-define-your-content) for the minimal shape, or [06 — Configuration](./06-configuration.md) for the full reference.

3. **Vend the admin into your app**

   ```bash
   bunx voila add admin-shell      # shell, routes, sidebar
   bunx voila add field/rich-text  # if you use richText() fields
   ```

   Each item declares its own npm deps; the CLI installs them. Run `voila list` to see everything available.

4. **Import the admin theme** in your global stylesheet:

   ```css
   /* app/styles/globals.css */
   @import '@voila/ui/styles.css';
   ```

5. **Cloudflare bindings** — in `wrangler.jsonc`, add a D1 database, R2 bucket, optional Queue, and `VOILA_AUTH_SECRET`. See [11 — Deployment](./11-deployment-cloudflare.md) for the canonical `wrangler.jsonc`.

6. **Run migrations**: `bunx voila migrate generate && bunx voila migrate apply`.

That's the whole manual recipe. The template (option A) is exactly this layout, frozen at the latest known-good versions.

> Need to own the HTTP handler logic itself (compliance, deep rewrites)? Run `voila add admin-shell --eject-server` to also vend the `HttpApi` definition and handlers. This is an opt-in escape hatch, not the default.

---

Continue → [03 — Developer Experience](./03-dx.md)
