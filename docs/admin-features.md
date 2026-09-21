# Admin features (0.2)

Everything below is driven from `content.config.ts` (the schema) and `defineAdmin`
(the admin instance) — no per-screen code. This guide covers the surface added in
the `@voila/content*` 0.2 release.

## Field groups

A collection or singleton can declare `groups` to lay its detail/edit page out as
a left sub-nav + cards instead of one flat form. Field order and group order come
from the arrays; the active group lives in the URL as `?group=`.

```ts
import { defineCollection, fields } from "@voila/content";

const posts = defineCollection({
  slug: "posts",
  titleField: "title",
  fields: {
    title: fields.string({ required: true }),
    body: fields.markdown(),
    coverImage: fields.media(),
    status: fields.enum({ values: { Draft: "draft", Published: "published" } }),
    location: fields.geo(),
  },
  groups: [
    { id: "content", label: "Content", icon: "FileText", fields: ["title", "body"] },
    { id: "media", label: "Media", icon: "Image", fields: ["coverImage"] },
    { id: "meta", label: "Metadata", icon: "Tag", fields: ["status", "location"] },
  ],
});
```

- `icon` is a [Phosphor](https://phosphoricons.com) name (resolved from
  `@phosphor-icons/react`); unknown names render nothing.
- Fields omitted from every group fall into a synthesized trailing **General**
  group — nothing disappears. No `groups` → the flat form (unchanged).

## Saved views, filters, columns, kanban & map

The collection list screen is view-aware. Views are **shared** (the engine-owned
`voila_views` table is global — scoped by collection, not by user, so everyone
sees and edits the same set) and switchable via **`ViewTabs`**; a view stores its
columns + order, sort, filters, type, and the kanban/map field. A seeded,
undeletable default **Table** view always exists, and `?view=<uid>` makes any view
a shareable URL.

- **Columns** — toggle visibility, drag (or up/down) to reorder.
- **Filters** — `field · operator · value` rows
  (`is / is not / contains / > / ≥ / < / ≤`), AND-ed. They run **server-side**
  (`?filter=field:op:value`), so paging + counts stay correct. Only scalar,
  non-localized fields are offered (the same gate the REST layer enforces).
- **View types** — table, **kanban** (group cards by an enum/select field, drag a
  card to change it), **map** (maplibre markers). Kanban/map auto-load up to a
  bounded number of pages; narrow with filters to see more.

Right-click a tab to Edit / Set-default / Delete, or drag tabs to reorder.
Filters, columns, and the kanban/map field are edited inside the **Edit view**
dialog. It all works with no host code — the config-driven list screen wires
`ViewTabs` and persists through the typed client's `views` sub-API
(`client.<collection>.views.{list,create,update,delete,reorder}`).

## Geo fields & maps

`fields.geo()` stores a `{ lat, lng }` point. It comes with:

- an **edit widget** — a dependency-free latitude/longitude pair, upgraded by the
  admin to a click-to-place / draggable-marker **map picker**;
- a **display widget** (`GeoDisplay`) — trimmed `lat, lng` linking to
  OpenStreetMap (in tables + detail rows);
- the **map view** — markers per row, popup titled by `titleField`.

Maps + the map picker use **maplibre-gl**, an *optional* peer dependency. To use
them, install it and import its stylesheet once in your root route:

```sh
bun add maplibre-gl
```

```ts
// app/routes/__root.tsx
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
// …add { rel: "stylesheet", href: maplibreCss } to your head links
```

Without maplibre, geo fields still edit (the lat/lng inputs) and display
(`GeoDisplay`); only the map surfaces are unavailable. Set the map style with
`defineAdmin({ mapStyleUrl })` (defaults to the public MapLibre demo style).

## Blocks, objects & arrays (page builder)

`fields.blocks({ types })` is an ordered, polymorphic list — the page-builder
primitive. A `pages` collection declares its section catalogue once; every block
stored is `{ type: "<key>", ...fields }`:

```ts
const pages = defineCollection({
  slug: "pages",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.slug({ from: "title" }),
    blocks: fields.blocks({
      types: {
        hero: {
          label: "Hero",
          icon: "Sparkle",
          description: "Big title over a picture",
          fields: {
            title: fields.string({ required: true }),
            image: fields.media({ accept: ["image/*"] }),
            body: fields.richText(),
          },
        },
        faq: {
          fields: {
            items: fields.array(
              fields.object({ question: fields.string({ required: true }), answer: fields.markdown() }),
            ),
          },
        },
        cta: { fields: { label: fields.string(), href: fields.string({ format: "url" }) } },
      },
    }),
  },
});
```

The admin gets, with no host code:

- **Add block** — a menu built from `types` (label, description, icon), a plain
  button when there is one type, disabled at `max`;
- one **collapsible card per block** — type badge, a summary line from the first
  text field, drag handle + move up / down + remove, the block's own fields inside;
- **nested editors** — every field inside a block, object or array renders its
  own widget through the same registry as top-level fields, so the media
  picker, relation combobox and rich-text editor a host injects with
  `defineAdmin({ widgets })` work at any depth;
- **nested errors** — a failed nested field shows its message under its own
  control (the card expands), and the field-level line keeps the path
  (`[2].title: Required.`), as does the server's 422 envelope.

`fields.object({ … })` and `fields.array(item)` get the same treatment: a
bordered member group, and a list with add / move / remove honouring `min` /
`max`. (An `array` whose item is a bare validator rather than a field still
shows the unsupported-input notice — there is no widget to render.)

On the site, `InferDoc<typeof config, "pages">["blocks"][number]` is a
discriminated union on `type`, so a `switch (block.type)` is exhaustive.

Limits, by design:

- **No localized fields inside** a block, object or array — localize the outer
  field (`blocks({ …, localized: true })`) and the whole list is per locale.
  The constructors throw otherwise.
- **No persisted per-block key.** React keys are handled client-side; declare a
  `fields.string()` yourself if a block needs a stable anchor.
- A blocks field is one **JSON column**: it is neither sortable, filterable nor
  searchable, and the list screen hides it from the default columns.
- Overriding the editor is the usual registry hook: `widgets.edit.blocks`.

## Per-field save

For grouped collections, the detail screen edits **per field**: each field is its
own card with its own Save that patches just that field. Editing one field doesn't
require the rest to be valid, and the page stays in edit so you can save several
cards before leaving (explicit **Done** returns to the read view). Ungrouped
collections and singletons keep the single whole-form Save.

This is `CollectionForm`'s `saveMode` prop (`"form"` default, `"field"` opt-in) —
the admin selects it automatically. `saveMode="field"` submits a one-key partial,
so it only suits a PATCH-style update (collections, not a singleton's
full-document `set`).

## Live preview

Declare a preview target per collection or singleton and the document screens
split in two: the form (or read view) on the left, the site's own page on the
right, re-rendered as you type — unsaved values included.

```ts
defineAdmin({
  config,
  preview: {
    pages: { url: (doc) => "/preview/pages", size: 50 },
    settings: { url: () => "/preview/settings" },
  },
});
```

`url` returns a **same-origin path** the admin loads in an iframe; `size` is the
pane's initial width in percent (default 50). The split is resizable and
remembered per slug in `localStorage`. The pane only renders on desktop
(≥ 1024px); narrower screens keep the plain form.

### The protocol

The admin never lets the frame read drafts: it **pushes** the document. Three
messages, same origin both ways:

| Direction | Message | When |
| --- | --- | --- |
| frame → admin | `{ type: "voila:preview:listening" }` | once the route has mounted |
| admin → frame | `{ type: "voila:preview", doc, seq, focus? }` | on the handshake, then on every edit (debounced 150 ms) |
| frame → admin | `{ type: "voila:preview:ready", seq }` | once `doc` is rendered |

`doc` is the form's current values — the whole document, even on a grouped form
that shows one group at a time. `focus` is the path of the nested row the
editor has open (`["blocks", 2]`), so the site can scroll to that section.
The admin ignores messages from another origin or another window, and shows
"Updating…" until the reply carrying the latest `seq` arrives.

### A preview route (TanStack Start)

The route renders the posted document with the same code as the live page —
here `resolvePage` is whatever turns a stored row into a page payload:

```tsx
// src/routes/_site.preview.$collection.tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

const previewPage = createServerFn({ method: "POST" })
  .validator((data: { doc: Record<string, unknown> }) => data)
  .handler(({ data }) => resolvePage({ id: "preview", ...data.doc }));

export const Route = createFileRoute("/_site/preview/$collection")({
  loader: ({ params }) => {
    if (params.collection !== "pages") throw notFound();
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: Preview,
});

function Preview() {
  const [page, setPage] = useState<PagePayload | null>(null);
  useEffect(() => {
    let latest = 0;
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "voila:preview") return;
      const seq = ++latest;
      const next = await previewPage({ data: { doc: event.data.doc } });
      if (seq !== latest) return; // a newer document is on its way
      setPage(next);
      window.parent.postMessage(
        { type: "voila:preview:ready", seq: event.data.seq },
        window.location.origin,
      );
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "voila:preview:listening" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return page ? <CmsPage data={page} /> : <p>Loading preview…</p>;
}
```

Reserve the `preview` slug in the collection's `slug` field so no page can
shadow the route. The route is public but inert: without a parent posting a
document it renders nothing, and it never queries the database for drafts.

### What it is not

A visual builder. The form stays the single place you edit; the preview shows
the result. Clicking inside the frame follows links like the real site.

## Customizing the admin

```ts
import { defineAdmin } from "@voila/content-admin";
import config from "../../content.config";

export const admin = defineAdmin({
  config,
  branding: { title: "Acme CMS" },
  mapStyleUrl: "https://api.maptiler.com/maps/streets/style.json?key=…",
  widgets: {
    edit: { richText: MyRichTextEditor }, // override any kind's edit widget
    display: { richText: MyRichTextRender },
  },
});
```

The map picker is injected automatically for `geo` fields; a `widgets.edit.geo`
override still wins.

## Theming the admin from your own content

The admin can take its accent colour and its logo from the project it manages —
so the editor who picks a brand colour in Settings is the person who restyles the
admin, with no deploy.

```ts
export const admin = defineAdmin({
  config,
  theme: {
    accentFrom: "settings.primaryColor", // a `fields.color()` in a singleton
    logoFrom: "settings.logo",           // a `fields.media()` in a singleton
    radius: "round",                     // "sharp" | "soft" (default) | "round"
    density: "comfortable",              // "compact" (default) | "comfortable"
  },
});
```

`accent: "#c0392b"` sets a fixed colour instead (and outranks `accentFrom`).

The stored hex is converted to OKLCH — the space the `@voila.dev/ui` tokens are
written in — and drives `--primary`, `--ring` and their sidebar counterparts, so
buttons, the active nav item, focus rings and the map's pins all follow it.
`--primary-foreground` is picked from the accent's relative luminance (black on a
yellow brand, white on a navy one), and the dark theme gets the same brand lifted
into a lightness its near-black ground can actually show.

Wire it up in the root route, which must resolve the brand **server-side** — the
tokens have to be in the first byte of HTML or the admin paints unbranded and
then flips:

```ts
// app/lib/brand.ts — a server fn over your Database
export const fetchBrand = createServerFn({ method: "GET" }).handler(() =>
  resolveBrandSource(admin.theme, runtime.database),
);

// app/routes/__root.tsx
export const Route = createRootRoute({
  loader: () => fetchBrand(),
  head: ({ loaderData }) => {
    const brand = brandingHead(admin.branding, {
      defaultFavicon,
      theme: admin.theme,
      brand: loaderData,
    });
    return { meta: [...brand.meta], links: [...brand.links], styles: [...brand.styles] };
  },
  component: RootComponent,
});
```

Pass the same `loaderData` to `<AdminProvider brand={…}>` so the sidebar mark and
the login page use the logo too; nested providers inherit it. A project that
configures no `theme` emits no style block at all and renders exactly as before.

## Self-contained local-dev auth

Pass `dev: import.meta.env.DEV` to `createWorkerAdmin` so magic-link sign-in works
under `vite dev`: in dev it drops a pinned `VOILA_BASE_URL` and lets Better Auth
infer the origin (and the magic-link verify URL) from each request, so links
target `http://localhost:<port>` instead of your production domain. The production
build (`import.meta.env.DEV === false`) keeps the pinned origin.

```ts
// app/lib/server.ts
export const runtime = createWorkerAdmin(config, { dev: import.meta.env.DEV });
```

## Who may sign in: the collection-backed allowlist

By default the admin is first-user-wins: the first account to sign in owns it and
every later address is denied. When several people need access — and the list
should be editable without a redeploy — keep it in a collection instead:

```ts
// content.config.ts
import { defineAdminsCollection, defineConfig } from "@voila/content";

export default defineConfig({
  collections: {
    // `admins` with `email` (+ `name`); labels/group/icon are overridable.
    admins: defineAdminsCollection({ label: "Administrateurs", group: "Réglages" }),
    // …
  },
});
```

```ts
// app/lib/server.ts
import { allowlistAccess } from "@voila/content/server";

export const runtime = createWorkerAdmin(config, {
  dev: import.meta.env.DEV,
  access: allowlistAccess(), // or { collection: "staff", field: "contactEmail" }
});
```

With this policy:

- magic-link sign-in returns 403 for an address that is not listed — no email is
  sent, and the login screen shows "not allowed";
- every REST request is authorized against the same table (verdicts cached 30 s,
  so removing a row locks the account out within that window);
- the host's `/admin` guard can use `resolveAdmission(runtime, request)` to send
  a signed-in but unlisted account back to the login page instead of rendering an
  admin shell whose every call fails.

Seed the collection before the first sign-in (a migration or your seed script):
an empty allowlist admits nobody. Any string field of email addresses works;
`allowlistAccess` throws at boot if the collection or field is not in the config.
