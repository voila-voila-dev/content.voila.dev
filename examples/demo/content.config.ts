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
    // A top-level media field. It provisions the engine-owned `voila_media`
    // table that the `_media` upload pipeline writes to — the same table the
    // rich-text editor's inline image uploads land in.
    coverImage: fields.media(),
    body: fields.markdown(),
    // Rich JSON content: edited with the Plate-based editor (toolbar, slash
    // menu, @-mentions) wired via app/lib/widgets.ts.
    content: fields.richText(),
    // Localized rich text: the admin renders one editor per project locale.
    summary: fields.richText({ localized: true }),
    published: fields.boolean({ defaultValue: false }),
    publishedAt: fields.datetime(),
  },
});

// Singletons are supported by the engine (write path + typed client shipped),
// but the demo only vends the per-collection admin routes (`admin.posts.*`), so
// a singleton would render a nav link with no matching route. Add a singleton
// here once you've vended an `admin.<slug>.*` route for it.

export default defineConfig({
  branding: { name: "demo" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { posts },
});
