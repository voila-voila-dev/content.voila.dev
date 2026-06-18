// The one file you maintain. Add collections and fields here; the admin UI,
// the typed client, and your database schema are all derived from it — no
// codegen. After editing, run `voila migrate generate` to update the schema.

import { defineCollection, defineConfig, fields } from "@voila/content";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  titleField: "title",
  fields: {
    title: fields.string({ required: true, max: 120 }),
    slug: fields.slug({ from: "title" }),
    body: fields.markdown(),
    published: fields.boolean({ defaultValue: false }),
    publishedAt: fields.datetime(),
  },
});

// Singletons (`defineSingleton`) are supported by the engine, but aren't
// scaffolded here: the starter only vends the per-collection admin routes, so a
// singleton would render a nav link with no matching route. Add one once you've
// vended an `admin.<slug>.*` route for it.

export default defineConfig({
  branding: { name: "{{projectName}}" },
  collections: { posts },
});
