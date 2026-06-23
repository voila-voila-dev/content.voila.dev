// The one file you maintain. Add collections and fields here; the admin UI, the
// typed client, and your database schema are all derived from it — no codegen,
// no per-collection route files. After editing, run `voila migrate generate` to
// update the schema.

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

// Add another collection and it shows up in the admin automatically — the
// dynamic `$collection` routes serve its list/create/edit pages with no new
// files. Singletons (`defineSingleton`) work the same way.

export default defineConfig({
  branding: { name: "{{projectName}}" },
  collections: { posts },
});
