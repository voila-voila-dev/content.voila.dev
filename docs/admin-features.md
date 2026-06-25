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

- `icon` is a [Phosphor](https://phosphoricons.com) name (rendered from
  `@voila/ui/icons`); unknown names render nothing.
- Fields omitted from every group fall into a synthesized trailing **General**
  group — nothing disappears. No `groups` → the flat form (unchanged).

## Saved views, filters, columns, kanban & map

The collection list screen is view-aware. Each user's views are **persisted**
(the engine-owned `voila_views` table, scoped to the signed-in principal) and
switchable; a view stores its columns + order, sort, filters, type, and the
kanban/map field.

- **Columns** — `ColumnPicker`: toggle visibility, drag (or up/down) to reorder.
- **Filters** — `FilterBuilder`: `field · operator · value` rows
  (`is / is not / contains / > / ≥ / < / ≤`), AND-ed. They run **server-side**
  (`?filter=field:op:value`), so paging + counts stay correct. Only scalar,
  non-localized fields are offered (the same gate the REST layer enforces).
- **View types** — table, **kanban** (group cards by an enum/select field, drag a
  card to change it), **map** (maplibre markers). The `ViewSwitcher` offers a
  field picker when there's a real choice (which enum field kanban groups by,
  which geo field the map plots). Kanban/map auto-load up to a bounded number of
  pages; narrow with filters to see more.

These work with no host code — the config-driven list screen wires
`ColumnPicker` / `FilterBuilder` / `ViewSwitcher` and persists through the typed
client's `views` sub-API (`client.<collection>.views.{list,create,update,delete}`).

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
