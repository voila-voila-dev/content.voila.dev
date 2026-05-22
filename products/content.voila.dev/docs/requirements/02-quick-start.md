# 02 — Quick Start

There are two ways to get started:

- **A. Scaffold from the template** — fastest path, you get a working site + admin in one command. Best for new projects.
- **B. Add to an existing TanStack Start app** — `voila init` patches your repo in place. Best if you already have a Start app you don't want to throw away.

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
- `app/routes/admin/$.ts` mounted catch-all
- `@voila/ui` theme tokens wired into `app/styles/globals.voila.css`
- `wrangler.jsonc` pre-configured with D1 + R2 bindings (commented, opt-in)
- Better Auth set up with email magic-link (Resend) and a GitHub OAuth stub

> The template tracks the latest `@voila/*` package versions and Better Auth release. Re-run `bunx create-voila@latest` against an empty dir to see the current set.

---

## B. Add to an existing project

Already have a TanStack Start app? Use `voila init` to patch it in place.

### 1. Create a TanStack Start app (skip if you already have one)

```bash
bunx create-tsr@latest my-site --template start-cloudflare
cd my-site
```

### 2. Add the CMS

```bash
bun add @voila/content @voila/ui @voila/storage
bunx voila init
```

`voila init` does four things:

1. Writes `content.config.ts` at the project root with a starter schema.
2. Adds `voila()` to `vite.config.ts` (auto-discovers the config).
3. Adds `globals.voila.css` to `app/styles/` (admin theme tokens).
4. Patches `wrangler.jsonc` with R2/D1 bindings (commented, opt-in).

No `app/routes/admin/*` files are created — the plugin registers the
admin route tree as virtual routes inside TanStack Start. See
[ADR 0002](../../../../docs/decision-records/0002-tanstack-start-integration.md).

Prefer to do it by hand? See [Manual install](#manual-install) below.

---

## 3. Define your content

```ts
// content.config.ts (project root)
import { defineContent, defineCollection, fields } from '@voila/content'
import { r2 } from '@voila/storage'

const posts = defineCollection({
  slug: 'posts',
  label: 'Posts',
  icon: 'NewspaperClipping',
  fields: {
    title: fields.string({ required: true, max: 120 }),
    slug:  fields.slug({ from: 'title' }),
    body:  fields.richText(),
    cover: fields.media({ accept: ['image/*'] }),
    tags:  fields.array(fields.string()),
    publishedAt: fields.datetime(),
  },
  list: { columns: ['title', 'publishedAt', 'tags'] },
})

export default defineContent({
  branding: { name: 'My Site', logo: '/logo.svg' },
  collections: [posts],
  storage: r2({ bucket: 'media' }),
})
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { voila } from '@voila/content/vite'

export default defineConfig({
  plugins: [
    voila(),       // auto-discovers ./content.config.ts
    tanstackStart(),
  ],
})
```

## 4. Run migrations & dev

```bash
bunx voila migrate    # generates + applies Drizzle migrations
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

- The catch-all route serves the admin at `/admin` and the API at `/admin/api`.
- The admin reads its own schema from `content.config.ts` at import-time.
- The DB schema is generated from your field definitions; Drizzle drives the migrations.
- The public client (`@voila/client`) is a tiny typed wrapper over `fetch` with the same schema.
- Media uploads go to R2; URLs are signed when needed.

---

## Manual install

If you want to know exactly what `voila init` touches (or you're integrating into a non-standard layout), do it by hand:

1. **Install packages**

   ```bash
   bun add @voila/content @voila/ui @voila/storage drizzle-orm better-auth
   bun add -d drizzle-kit @voila/cli
   ```

2. **Create `content.config.ts`** at the project root — see [§3 Define your content](#3-define-your-content) for the minimal shape, or [06 — Configuration](./06-configuration.md) for the full reference.

3. **Add the vite plugin** to `vite.config.ts`:

   ```ts
   import { defineConfig } from 'vite'
   import { tanstackStart } from '@tanstack/react-start/plugin/vite'
   import { voila } from '@voila/content/vite'

   export default defineConfig({
     plugins: [
       voila(),       // auto-discovers ./content.config.ts
       tanstackStart(),
     ],
   })
   ```

4. **Import the admin theme** in your global stylesheet:

   ```css
   /* app/styles/globals.css */
   @import '@voila/ui/styles.css';
   ```

5. **Cloudflare bindings** — in `wrangler.jsonc`, add a D1 database, R2 bucket, optional Queue, and `VOILA_AUTH_SECRET` (used by Better Auth to sign sessions). See [11 — Deployment](./11-deployment-cloudflare.md) for the canonical `wrangler.jsonc`.

6. **Run migrations**: `bunx voila migrate`.

That's the whole manual recipe. The template (option A) is exactly this layout, frozen at the latest known-good versions.

> If you can't use the vite plugin (custom build, multi-tenant
> dispatch), see [08 — Extensions](./08-extensions.md) for the
> escape-hatch route factories.

---

Continue → [03 — Developer Experience](./03-dx.md)
