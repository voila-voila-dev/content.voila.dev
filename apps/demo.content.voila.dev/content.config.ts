// The one file you maintain. Add collections and fields here; the admin UI,
// the typed client, and your database schema are all derived from it — no
// codegen. After editing, run `voila migrate generate` to update the schema.
//
// ── The demo business ───────────────────────────────────────────────────────
// Cinéma Vertigo is an independent repertory cinema in Lisbon: two screens, a
// programme of restored classics and new arthouse, introductions and Q&As, and
// a written journal. It was chosen because a cinema is genuinely content-shaped
// — a catalogue (films) whose items are scheduled many times over (screenings),
// credited to people, and written about — so every field kind earns its place
// instead of being sprinkled on to show off:
//
//   relation   a screening points at a film; a film at its director
//   datetime   showtimes  → the Calendar view is the actual programme
//   enum       on sale / cancelled → the Kanban board is the programming desk
//   geo        where each film was SHOT → the Map view is "the programme, mapped"
//   media      posters and stills
//   richText   programme notes and journal essays
//   localized  the cinema publishes in English and Portuguese
//   multiSelect print formats (35mm, DCP…) and journal tags
//
// The public website in `apps/vertigo.content.voila.dev` is rendered from these
// exact collections through the typed client, so the demo shows both halves:
// the editor's admin and the site their readers see.

import { defineCollection, defineConfig, defineSingleton, fields } from "@voila/content";

const SCREENS = ["Sala Grande", "Sala Azul", "Esplanada"] as const;
const COUNTRIES = [
  "Portugal",
  "France",
  "Italy",
  "Japan",
  "United States",
  "Senegal",
  "Taiwan",
  "Brazil",
  "Germany",
  "Iran",
] as const;
const FORMATS = ["35mm", "16mm", "70mm", "DCP", "Digital restoration"] as const;
const CERTIFICATES = ["U", "PG", "12", "16", "18"] as const;
const JOURNAL_TAGS = [
  "Programme note",
  "Interview",
  "Essay",
  "Restoration",
  "Season",
  "Obituary",
] as const;

// ── People ──────────────────────────────────────────────────────────────────
// Directors, invited guests and the cinema's own programmers. Films and journal
// entries point here, so one person's page can gather everything they touched.
const people = defineCollection({
  slug: "people",
  label: "People",
  labelSingular: "Person",
  icon: "Users",
  titleField: "name",
  fields: {
    name: fields.string({ required: true, max: 80 }),
    slug: fields.slug({ from: "name" }),
    role: fields.select({
      options: ["Director", "Programmer", "Guest", "Projectionist", "Writer"],
      description: "How this person appears on the site.",
    }),
    portrait: fields.media(),
    bio: fields.richText({ localized: true }),
    // Home city — plots the people behind the programme on the Map view.
    bornIn: fields.geo({ description: "Home city, shown on the People map." }),
    website: fields.string({ format: "url" }),
  },
  groups: [
    { id: "profile", label: "Profile", icon: "User", fields: ["name", "slug", "role", "website"] },
    { id: "about", label: "About", icon: "Article", fields: ["portrait", "bio", "bornIn"] },
  ],
});

// ── Films ───────────────────────────────────────────────────────────────────
// The catalogue. A film is written once and scheduled many times; `status`
// drives the Kanban board the programmers work from.
const films = defineCollection({
  slug: "films",
  label: "Films",
  labelSingular: "Film",
  icon: "FilmSlate",
  titleField: "title",
  // Snapshot every write so the detail page's version history can diff + restore.
  revisions: true,
  fields: {
    // Localized: the cinema publishes each film's page in English and Portuguese.
    // `required` means the DEFAULT locale must be filled — a translation can
    // land later without blocking the programmer.
    title: fields.string({ required: true, max: 140, localized: true }),
    slug: fields.slug({ from: "title" }),
    originalTitle: fields.string({
      max: 140,
      description: "As credited on the print, if it differs from the release title.",
    }),
    synopsis: fields.string({ max: 400, localized: true }),
    // The programmer's note — what the audience reads before the lights go down.
    notes: fields.richText({ localized: true }),
    poster: fields.media(),
    still: fields.media({ description: "Wide frame used as the page header." }),
    // A real relation: resolved to the person's record, not a copied string.
    director: fields.relation({ to: "people" }),
    year: fields.number({ integer: true, min: 1888, max: 2100, grouping: false }),
    runtime: fields.number({ integer: true, min: 1, max: 600, description: "Minutes." }),
    country: fields.select({ options: COUNTRIES }),
    formats: fields.multiSelect({
      options: FORMATS,
      description: "Every print or master we can project.",
    }),
    certificate: fields.select({ options: CERTIFICATES }),
    status: fields.enum({
      values: { Draft: "draft", Programmed: "programmed", "Now showing": "showing" },
    }),
    featured: fields.boolean({ defaultValue: false }),
    // Drives the film page's accent — the poster's dominant colour.
    accentColor: fields.color({ format: "hex" }),
    // Where the film was SHOT. The Map view turns the programme into an atlas.
    shotIn: fields.geo({ description: "Principal shooting location." }),
    trailerUrl: fields.string({ format: "url" }),
  },
  groups: [
    {
      id: "billing",
      label: "Billing",
      icon: "FileText",
      fields: ["title", "slug", "originalTitle", "synopsis", "notes"],
    },
    { id: "artwork", label: "Artwork", icon: "Image", fields: ["poster", "still", "accentColor"] },
    {
      id: "credits",
      label: "Credits",
      icon: "Users",
      fields: ["director", "year", "runtime", "country", "shotIn"],
    },
    {
      id: "programming",
      label: "Programming",
      icon: "Tag",
      fields: ["status", "featured", "formats", "certificate", "trailerUrl"],
    },
  ],
});

// ── Screenings ──────────────────────────────────────────────────────────────
// One showing of one film. This is the collection the Calendar view was built
// for: a month of `startsAt` values IS the programme.
const screenings = defineCollection({
  slug: "screenings",
  label: "Screenings",
  labelSingular: "Screening",
  icon: "CalendarDots",
  titleField: "label",
  fields: {
    // A human handle for the row — "Vertigo · Fri 19 Sep, 21:00".
    label: fields.string({ required: true, max: 140 }),
    film: fields.relation({ to: "films", description: "What is on the screen." }),
    startsAt: fields.datetime(),
    endsAt: fields.datetime(),
    screen: fields.select({ options: SCREENS }),
    presentation: fields.select({
      options: ["Regular", "Introduced", "Q&A", "Double bill", "Members only"],
    }),
    // Who introduces it, when someone does.
    host: fields.relation({ to: "people" }),
    status: fields.enum({
      values: { Draft: "draft", "On sale": "on-sale", Cancelled: "cancelled" },
    }),
    soldOut: fields.boolean({ defaultValue: false }),
    ticketUrl: fields.string({ format: "url" }),
    note: fields.string({ max: 200, localized: true }),
  },
  groups: [
    {
      id: "billing",
      label: "Billing",
      icon: "FilmSlate",
      fields: ["label", "film", "presentation", "host", "note"],
    },
    { id: "schedule", label: "Schedule", icon: "Clock", fields: ["startsAt", "endsAt", "screen"] },
    {
      id: "tickets",
      label: "Tickets",
      icon: "Tag",
      fields: ["status", "soldOut", "ticketUrl"],
    },
  ],
});

// ── Journal ─────────────────────────────────────────────────────────────────
// Essays, interviews and restoration notes. Points at both a film and an author,
// so a film page can list everything written about it.
const journal = defineCollection({
  slug: "journal",
  label: "Journal",
  labelSingular: "Entry",
  icon: "Article",
  titleField: "title",
  revisions: true,
  fields: {
    title: fields.string({ required: true, max: 140, localized: true }),
    slug: fields.slug({ from: "title" }),
    excerpt: fields.string({ max: 280, localized: true }),
    body: fields.richText({ localized: true }),
    cover: fields.media(),
    author: fields.relation({ to: "people" }),
    aboutFilm: fields.relation({ to: "films", description: "Links this entry to a film page." }),
    tags: fields.multiSelect({ options: JOURNAL_TAGS }),
    status: fields.enum({
      values: { Draft: "draft", "In review": "review", Published: "published" },
    }),
    publishedAt: fields.datetime(),
  },
  groups: [
    {
      id: "writing",
      label: "Writing",
      icon: "FileText",
      fields: ["title", "slug", "excerpt", "body"],
    },
    { id: "artwork", label: "Artwork", icon: "Image", fields: ["cover"] },
    {
      id: "filing",
      label: "Filing",
      icon: "Tag",
      fields: ["author", "aboutFilm", "tags", "status", "publishedAt"],
    },
  ],
});

// ── Settings ────────────────────────────────────────────────────────────────
// The cinema itself: what the public site puts in its header, footer and
// contact block. `primaryColor` also themes the admin.
const settings = defineSingleton({
  slug: "settings",
  label: "Settings",
  icon: "GearSix",
  fields: {
    siteName: fields.string({ required: true, localized: true }),
    tagline: fields.string({ localized: true }),
    about: fields.richText({ localized: true }),
    logo: fields.media(),
    primaryColor: fields.color({ format: "hex" }),
    address: fields.string({ max: 200 }),
    location: fields.geo({ description: "Pin on the visit page." }),
    openingHours: fields.string({ max: 200, localized: true }),
    contactEmail: fields.string({ format: "email" }),
    instagram: fields.string({ format: "url" }),
  },
  groups: [
    {
      id: "branding",
      label: "Branding",
      icon: "Palette",
      fields: ["siteName", "tagline", "about", "logo", "primaryColor"],
    },
    {
      id: "visit",
      label: "Visit",
      icon: "MapPin",
      fields: ["address", "location", "openingHours"],
    },
    { id: "contact", label: "Contact", icon: "Envelope", fields: ["contactEmail", "instagram"] },
  ],
});

// Add another collection (or a `defineSingleton`) and it shows up in the admin
// automatically — the dynamic `$collection` routes from `@voila/content-admin`
// serve its pages with no new files.

export default defineConfig({
  branding: { name: "Cinéma Vertigo" },
  i18n: { locales: ["en-US", "pt-PT"], defaultLocale: "en-US" },
  // Basemap for the admin's map surfaces (the list Map view + the geo field's
  // location picker). Defaults to the free, key-less OpenFreeMap styles below and
  // follows the admin's light/dark theme; point these at your own style (e.g. a
  // MapTiler/Mapbox style) for richer cartography.
  map: {
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    darkStyleUrl: "https://tiles.openfreemap.org/styles/dark",
  },
  collections: { films, screenings, people, journal },
  singletons: { settings },
});
