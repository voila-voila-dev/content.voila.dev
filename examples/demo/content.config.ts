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

// Add another collection (or a `defineSingleton`) and it shows up in the admin
// automatically — the dynamic `$collection` routes from `@voila/content-admin` serve its
// pages with no new files.

export default defineConfig({
  branding: { name: "demo" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { posts },
});
