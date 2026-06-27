// The one file you maintain. Add collections and fields here; the admin UI,
// the typed client, and your database schema are all derived from it — no
// codegen. After editing, run `voila migrate generate` to update the schema.
//
// This demo models a small editorial / travel publication so it exercises the
// whole admin: multiple collections, every list view (Table, Kanban via an
// `enum`, Map via `geo`, Calendar via `datetime`), localized fields, the Plate
// rich-text editor, media uploads, version history, and grouped detail forms.
// Every field kind used here has a working edit + display widget in the admin.

import { defineCollection, defineConfig, defineSingleton, fields } from "@voila/content";

// Shared option lists. Relations between collections aren't a rendered widget
// yet, so cross-references (a post's author/category) are modelled as `select`
// option sets — they group cleanly in Kanban and read well in the table.
const CATEGORIES = ["Travel", "Food", "Culture", "Outdoors", "City Guides"] as const;
const AUTHOR_NAMES = ["Maya Okonkwo", "Liam Fraser", "Sofia Marchetti", "Noah Bergström"] as const;
const EVENT_KINDS = ["Workshop", "Meetup", "Conference", "Tour"] as const;

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  titleField: "title",
  // Snapshot every write so the detail page's version history can diff + restore.
  revisions: true,
  fields: {
    // Localized text: the admin renders one input per project locale (en-US, fr-FR).
    title: fields.string({ required: true, max: 140, localized: true }),
    slug: fields.slug({ from: "title" }),
    // Short localized summary shown in cards and lists.
    excerpt: fields.string({ max: 280, localized: true }),
    // The main article body — the Plate-based editor (toolbar, slash menu,
    // @-mentions, inline images) wired in app/lib/admin.ts.
    body: fields.richText(),
    // A top-level media field. It provisions the engine-owned `voila_media`
    // table the `_media` upload pipeline writes to — the same table the
    // rich-text editor's inline image uploads land in.
    coverImage: fields.media(),
    // Cross-references modelled as option sets (see note above).
    category: fields.select({ options: CATEGORIES }),
    author: fields.select({ options: AUTHOR_NAMES }),
    // Editorial status — an enum, so the list's Kanban view can group by it.
    status: fields.enum({
      values: { Draft: "draft", "In review": "review", Published: "published" },
    }),
    featured: fields.boolean({ defaultValue: false }),
    readingMinutes: fields.number({ integer: true, min: 1, max: 120 }),
    // Brand accent for the article — shows the color picker widget.
    accentColor: fields.color({ format: "hex" }),
    // A geographic point ({ lat, lng }) — the list's Map view plots it.
    location: fields.geo(),
    // Drives the list's Calendar view.
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
      fields: ["title", "slug", "excerpt", "body"],
    },
    { id: "media", label: "Media", icon: "Image", fields: ["coverImage"] },
    {
      id: "organization",
      label: "Organization",
      icon: "Tag",
      fields: ["category", "author", "status", "featured", "accentColor"],
    },
    {
      id: "meta",
      label: "Metadata",
      icon: "Info",
      fields: ["readingMinutes", "location", "publishedAt"],
    },
  ],
});

// A second content collection — the people behind the posts. Stands alone in the
// admin (its own Table/Map views) and shows a different field mix.
const authors = defineCollection({
  slug: "authors",
  label: "Authors",
  titleField: "name",
  fields: {
    name: fields.string({ required: true, max: 80 }),
    slug: fields.slug({ from: "name" }),
    avatar: fields.media(),
    role: fields.select({ options: ["Editor", "Writer", "Photographer", "Contributor"] }),
    email: fields.string({ format: "email" }),
    bio: fields.richText({ localized: true }),
    // Where they're based — plots authors on the Map view too.
    location: fields.geo(),
  },
  groups: [
    {
      id: "profile",
      label: "Profile",
      icon: "User",
      fields: ["name", "slug", "role", "email", "location"],
    },
    { id: "about", label: "About", icon: "Article", fields: ["avatar", "bio"] },
  ],
});

// Events — built to show off the Calendar view (start/end datetimes) and the
// Map view (venue location) together.
const events = defineCollection({
  slug: "events",
  label: "Events",
  titleField: "title",
  fields: {
    title: fields.string({ required: true, max: 140, localized: true }),
    slug: fields.slug({ from: "title" }),
    summary: fields.string({ max: 280, localized: true }),
    description: fields.richText(),
    kind: fields.select({ options: EVENT_KINDS }),
    status: fields.enum({ values: { Draft: "draft", Published: "published" } }),
    venue: fields.string({ max: 120 }),
    location: fields.geo(),
    coverImage: fields.media(),
    startsAt: fields.datetime(),
    endsAt: fields.datetime(),
  },
  groups: [
    {
      id: "details",
      label: "Details",
      icon: "CalendarBlank",
      fields: ["title", "slug", "summary", "description", "kind", "status", "venue"],
    },
    { id: "schedule", label: "Schedule", icon: "Clock", fields: ["startsAt", "endsAt"] },
    { id: "place", label: "Location & Media", icon: "MapPin", fields: ["location", "coverImage"] },
  ],
});

// A singleton with groups too — the same sub-nav + card layout on its edit page.
const settings = defineSingleton({
  slug: "settings",
  label: "Settings",
  fields: {
    siteName: fields.string({ required: true, localized: true }),
    tagline: fields.string({ localized: true }),
    logo: fields.media(),
    primaryColor: fields.color({ format: "hex" }),
    contactEmail: fields.string({ format: "email" }),
  },
  groups: [
    {
      id: "branding",
      label: "Branding",
      icon: "Palette",
      fields: ["siteName", "tagline", "logo", "primaryColor"],
    },
    { id: "contact", label: "Contact", icon: "Envelope", fields: ["contactEmail"] },
  ],
});

// Add another collection (or a `defineSingleton`) and it shows up in the admin
// automatically — the dynamic `$collection` routes from `@voila/content-admin`
// serve its pages with no new files.

export default defineConfig({
  branding: { name: "Voilà Demo" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  // Basemap for the admin's map surfaces (the list Map view + the geo field's
  // location picker). Defaults to the free, key-less OpenFreeMap styles below and
  // follows the admin's light/dark theme; point these at your own style (e.g. a
  // MapTiler/Mapbox style) for richer cartography.
  map: {
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    darkStyleUrl: "https://tiles.openfreemap.org/styles/dark",
  },
  collections: { posts, authors, events },
  singletons: { settings },
});
