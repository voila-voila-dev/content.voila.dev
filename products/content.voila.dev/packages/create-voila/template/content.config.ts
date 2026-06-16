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

// Singletons (`defineSingleton`) are intentionally not scaffolded yet: the
// engine's singleton write path and client accessors are still in flight
// (docs/2026-06-12-ui-ux-devx-audit.md #9), and the nav must never link to a
// page that can't work.

export default defineConfig({
  branding: { name: "{{projectName}}" },
  collections: { posts },
});
