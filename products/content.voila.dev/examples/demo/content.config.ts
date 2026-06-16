// The one file you maintain. Add collections and fields here; the admin UI,
// the typed client, and your database schema are all derived from it — no
// codegen. After editing, run `voila migrate generate` to update the schema.

import { defineCollection, defineConfig, defineSingleton, fields } from "@voila/content";

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

const settings = defineSingleton({
  slug: "settings",
  fields: {
    siteName: fields.string({ required: true }),
  },
});

export default defineConfig({
  branding: { name: "demo" },
  collections: { posts },
  singletons: { settings },
});
