# 05 — Collections & Singletons

A **collection** is a repeatable type (posts, products, users). A **singleton** is a unique document (site settings, homepage hero, footer).

## Collection

```ts
import { defineCollection } from "@voila/content"
import { fields } from "@voila/content-schema"

export const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  icon: "NewspaperClipping",           // any Phosphor icon name
  description: "Articles published on the blog.",

  fields: {
    title: fields.string({ required: true }),
    slug:  fields.slug({ from: "title" }),
    body:  fields.richText(),
    cover: fields.media({ accept: ["image/*"] }),
    tags:  fields.array(fields.string()),
    publishedAt: fields.datetime(),
    author: fields.relation({ to: "users" }),
  },

  // Behavior
  versioning: true,                    // every save creates a version
  drafts:     true,                    // separate draft/published states
  scheduled:  true,                    // publishedAt in future → auto-publish via queue
  trash:      true,                    // soft delete

  // Access control — predicates compiled by RbacService into SQL WHERE
  access: {
    read:   () => true,                // public read
    create: (ctx) => ctx.user?.role === "editor",
    update: (ctx, doc) => ctx.user?.id === doc.author || ctx.user?.role === "admin",
    delete: (ctx) => ctx.user?.role === "admin",
  },

  // Admin presentation
  admin: {
    group: "Content",                  // sidebar group
    titleField: "title",
    defaultSort: { field: "publishedAt", dir: "desc" },
  },

  // List view
  list: {
    columns: [
      "title",
      { field: "publishedAt", label: "Published" },
      { field: "tags", cell: "TagPillsCell" },
    ],
    filters: ["tags", "publishedAt", "author"],
    search:  ["title", "body"],
    pageSize: 25,
  },

  // Detail view
  detail: {
    layout: [
      { tab: "Content",  fields: ["title", "slug", "body", "cover"] },
      { tab: "Metadata", fields: ["tags", "publishedAt", "author"] },
    ],
    sidebar: ["status", "publishedAt", "author"],
  },

  // Lifecycle hooks — run by HookService (an Effect Service) in sequence
  hooks: {
    beforeCreate: ({ doc, ctx }) => Effect.succeed(doc),
    afterCreate:  ({ doc, ctx }) => Effect.void,
    beforeUpdate: ({ doc, prev, ctx }) => Effect.succeed(doc),
    afterUpdate:  ({ doc, prev, ctx }) => Effect.void,
    beforeDelete: ({ doc, ctx }) => Effect.void,
    afterDelete:  ({ doc, ctx }) => Effect.void,
  },

  // Row actions (see 08 — Extensions)
  actions: [
    {
      id: "duplicate",
      label: "Duplicate",
      icon: "CopySimple",
      scope: "row",
      run: ({ doc, ctx }) =>
        Effect.flatMap(ctx.database.posts, (db) =>
          db.create({ ...doc, id: undefined, slug: `${doc.slug}-copy` }),
        ),
    },
  ],
})
```

Every prop except `slug` and `fields` is optional. Defaults are sensible.

### Hooks and the Effect engine

Hooks are functions that return `Effect` values. The engine's `HookService` sequences them — `before*` hooks may transform the document; `after*` hooks run for side effects. You never call them directly; provide them and the engine wires them into the resolver pipeline.

If you want to intercept mutations globally (audit log, event bus), wrap the `MutationService` `Layer` instead of repeating hook logic across collections:

```ts
// content.config.ts
defineContent({
  // …
  layers: [Layer.effect(MutationService, auditedMutations)],
})
```

## Singleton

A singleton is a collection-of-one. It has no list view, no slug, no ID — just an edit page.

```ts
import { defineSingleton } from "@voila/content"
import { fields } from "@voila/content-schema"

export const siteSettings = defineSingleton({
  slug: "site-settings",
  label: "Site Settings",
  icon: "Gear",

  fields: {
    title:       fields.string({ required: true }),
    description: fields.string(),
    logo:        fields.media({ accept: ["image/svg+xml", "image/png"] }),
    primaryColor: fields.color(),
    social: fields.object({
      twitter:   fields.string({ format: "url" }),
      instagram: fields.string({ format: "url" }),
    }),
  },

  access: {
    read:   () => true,
    write:  (ctx) => ctx.user?.role === "admin",
  },
})
```

Singletons land in the sidebar under "Settings" by default; override with `admin.group`.

In the public client:

```ts
const settings = await client.singletons.siteSettings.get()
//    ^? { title: string; description: string; logo: Media | null; ... }
```

## Relations

Three flavors, all handled the same way at the DX level:

- **one-to-many**: `fields.relation({ to: "authors" })` on the child.
- **many-to-many**: `fields.relation({ to: "tags", many: true })`. Junction table is auto-created and managed.
- **polymorphic**: `fields.polymorphic({ to: ["posts", "pages"] })`. Stored as `{ type, id }`.

The admin renders relations as searchable comboboxes. The API exposes `?include=author,tags`:

```ts
const post = await client.posts.findOne({ slug }, { include: ["author", "tags"] })
//          ^ author and tags are typed objects, not just IDs
```

## Lifecycle: drafts, versions, scheduling

When `versioning: true`:

- Every save creates a row in `posts_versions`.
- The admin shows a "Versions" tab with diff + restore.
- Versions are immutable, GC'd after `retention.versionDays` (default 90).

When `drafts: true`:

- `posts` table has `status: "draft" | "published"`.
- The public API returns only `published` by default.
- Authenticated previews can request drafts: `?status=draft&token=...`.

When `scheduled: true`:

- A `publishedAt` in the future + status=published → status="scheduled".
- A built-in queue job (via `@voila/content`) promotes scheduled docs every minute.

These three flags are independent. Turn them on per-collection.

## Soft delete (trash)

`trash: true` adds a `deletedAt` column. Deleted docs are excluded from queries by default, listed in the admin's "Trash" view, and permanently purged after `retention.trashDays` (default 30).

## Imports & exports

Every collection gets two endpoints automatically:

```
GET  /admin/api/posts/export?format=json|csv
POST /admin/api/posts/import        body: multipart form, file
```

The admin exposes them as buttons in the list header. Import does dry-run + validation (via `Schema.decodeUnknown`) + commit.

## Search

If any field has `searchable: true` or `list.search` lists it, an FTS index is maintained:

- on **D1**: FTS5 virtual table, rebuilt incrementally on write
- on **Postgres**: `tsvector` column with a GIN index
- on **SQLite**: FTS5

Public API:

```
GET /api/posts?q=hello+world
```

---

Continue → [06 — Configuration](./06-configuration.md)
