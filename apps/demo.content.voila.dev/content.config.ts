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
    // Editorial status — an enum, so the admin list's Kanban view can group by it.
    status: fields.enum({
      values: { Draft: "draft", "In review": "review", Published: "published" },
    }),
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
    // A geographic point ({ lat, lng }) — the admin list's Map view plots it.
    location: fields.geo(),
    published: fields.boolean({ defaultValue: false }),
    publishedAt: fields.datetime(),
  },
  // Field groups render the detail/edit page as a left sub-nav + one card per
  // group (order = array order). Fields named by no group fall into a trailing
  // "General" group automatically.
  groups: [
    {
      id: "content",
      label: "Content",
      icon: "FileText",
      fields: ["title", "slug", "content", "body", "summary"],
    },
    { id: "media", label: "Media", icon: "Image", fields: ["coverImage"] },
    {
      id: "meta",
      label: "Metadata",
      icon: "Tag",
      fields: ["status", "location", "published", "publishedAt"],
    },
  ],
});

// A singleton with groups too — the same sub-nav + card layout on its edit page.
const settings = defineSingleton({
  slug: "settings",
  label: "Settings",
  fields: {
    siteName: fields.string({ required: true }),
    tagline: fields.string(),
    contactEmail: fields.string(),
  },
  groups: [
    { id: "general", label: "General", icon: "Gear", fields: ["siteName", "tagline"] },
    { id: "contact", label: "Contact", icon: "Envelope", fields: ["contactEmail"] },
  ],
});

// Add another collection (or a `defineSingleton`) and it shows up in the admin
// automatically — the dynamic `$collection` routes from `@voila/content-admin` serve its
// pages with no new files.

export default defineConfig({
  branding: { name: "demo" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { posts },
  singletons: { settings },
});
