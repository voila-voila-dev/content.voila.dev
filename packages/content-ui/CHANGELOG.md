# @voila/content-ui

## 0.5.1

### Patch Changes

- [#55](https://github.com/voila-voila-dev/content.voila.dev/pull/55) [`d6ccd59`](https://github.com/voila-voila-dev/content.voila.dev/commit/d6ccd597210d395b5c67ae22a7929acdf4cb2da2) Thanks [@emilienbidet](https://github.com/emilienbidet)! - The sign-in screen's "the first account to sign in becomes the admin" line is
  now its own message (`admin.signInFirstAccount`) and can be turned off with
  `defineAdmin({ signIn: { firstAccountIsAdmin: false } })` — for admins behind
  an access policy such as `allowlistAccess()`, where it isn't true.
- Updated dependencies []:
  - @voila/content@0.5.1

## 0.5.0

### Minor Changes

- [#53](https://github.com/voila-voila-dev/content.voila.dev/pull/53) [`9a1f1ea`](https://github.com/voila-voila-dev/content.voila.dev/commit/9a1f1ea2ea38070f2e1cc5a1bf80fd1131e36624) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Admin in French, phone layout fixes, and a per-field widget option.

  - **Chrome messages.** Every visible string of the admin ("Save", "Showing 3 of
    12", "Sign out", validation, toasts, the login screen) now comes from a
    message catalog. `defineAdmin({ locale: "fr-FR" })` switches the whole admin
    to French, not just the dates and numbers; `defineAdmin({ messages })`
    rewords any key (`{ common: { save: "Publier" } }`). `MessagesProvider`,
    `useMessages`, `resolveMessages` and the `en`/`fr` catalogs are exported
    from `@voila/content-ui`; components outside a provider stay in English.
  - **Magic-link email.** `resendMailer({ locale })` writes the subject and body
    in French; `createWorkerAdmin` takes `locale` (pass the same value as
    `defineAdmin`) and now names the site in the subject (`brand`, defaulting
    to the config's `branding.name`, where it said "Voila" before).
  - **Phone.** The read view stacks each label above its value below 640px,
    and the previous/next record arrows are hidden there so the header keeps
    room for the title and actions.
  - **`widget` on every field.** `fields.string({ widget: "cdnImage" })` picks
    the admin widget for that one field, looked up in the registries before
    the field's kind — inside arrays, objects and blocks too. Register it with
    `defineAdmin({ widgets: { edit: { cdnImage }, display: { cdnImage } } })`.

### Patch Changes

- Updated dependencies [[`9a1f1ea`](https://github.com/voila-voila-dev/content.voila.dev/commit/9a1f1ea2ea38070f2e1cc5a1bf80fd1131e36624)]:
  - @voila/content@0.5.0

## 0.4.0

### Minor Changes

- [#43](https://github.com/voila-voila-dev/content.voila.dev/pull/43) [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Add `fields.blocks({ types })` — an ordered, polymorphic list of `{ type, ...fields }` records (the page-builder primitive) — with generic edit and display widgets for `blocks`, `object` and `array`.

  - `array` / `object` metas now carry the nested fields (`meta.item` / `meta.shape`), so the admin renders one widget per member; nested fields resolve through the registry in scope (`EditRegistryProvider` / `useEditRegistry`), so host-injected media, relation and rich-text widgets work inside a block.
  - `CollectionForm` surfaces nested validation issues under the nested control (`EditWidgetProps.issues`, `validateFields().issues`); the field-level message and the client's `issuesByField` keep the sub-path (`[2].title: Required.`).
  - The DDL deriver stores `blocks` as JSON and now ships `voila_media` when the only media field is nested.
  - `FieldRow` (the label / help / error chrome of one field) and `NestedFields` are exported.
  - Breaking for `fields.object`: members that are voila fields follow the write path's blank rule — an empty optional member is omitted instead of failing. Mark members `required: true` to keep them mandatory.

- [#48](https://github.com/voila-voila-dev/content.voila.dev/pull/48) [`d83354d`](https://github.com/voila-voila-dev/content.voila.dev/commit/d83354d633dc98aded04b4e96ab9a5d41b3eb9f8) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Compact array and object editors. An array of objects (`fields.array(fields.object(…))`)
  now renders as collapsible cards — drag handle, a one-line summary from the first
  text member, move / remove, expanded on demand — the same shell as the blocks
  editor (`SortableList`, now shared). An object whose members are a handful of
  short scalars (`{ label, href }`, `{ icon, text }`) lays them out inline on one
  row instead of stacking them; `layoutFor(shape)` decides. Scalar arrays and
  long-form objects keep their layout. The admin widens the edit form to the
  `content` measure when the fields on screen include a blocks, array or object
  editor (`formWidthFor`).

- [#47](https://github.com/voila-voila-dev/content.voila.dev/pull/47) [`0b0e6be`](https://github.com/voila-voila-dev/content.voila.dev/commit/0b0e6bea1a30d9399fd40e49eb0d603377810ee0) Thanks [@emilienbidet](https://github.com/emilienbidet)! - External collections. `defineCollection({ external: true, … })` declares a
  collection with no table in the content database: the migrations skip it and
  the runtime serves it from a host-provided `CollectionSource` (in
  `@voila/content/server`) registered under the slug —
  `makeDatabase(config, driver, { sources: { customers } })`. Only `list` and
  `get` are mandatory on a source; `findOne`/`create`/`update`/`delete`/`search`
  are optional, and a missing one answers `405 NOT_SUPPORTED` (new `ApiFailure`
  code; `DatabaseError.unsupported` underneath). REST routes, list filters/sort/
  count, saved views and the typed client work unchanged over a source.

  Alongside: `operations: { create?, update?, delete? }` on a collection switches
  a write operation off (the route answers 405 and the admin hides the matching
  UI), and `readOnly: true` on any field makes it display-only — the record form
  renders it without an input and the write routes reject a payload naming it
  (403 `FORBIDDEN`, like a per-field `access.write` denial); a required readOnly
  field is not demanded on create.

- [#49](https://github.com/voila-voila-dev/content.voila.dev/pull/49) [`d3915c0`](https://github.com/voila-voila-dev/content.voila.dev/commit/d3915c00b43f3c3dfb36a588a323880df1c28dcb) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Live preview. `defineAdmin({ preview: { pages: { url: (doc) => "/preview/pages" } } })`
  splits a document's detail and edit screens into the form and an iframe on the
  site's own preview route, fed the document over `postMessage` as it is edited —
  unsaved values included. The frame announces itself (`voila:preview:listening`),
  receives `{ type: "voila:preview", doc, seq, focus? }` and answers
  `voila:preview:ready`; the admin never lets the frame read drafts. Resizable,
  remembered per slug, desktop only. `content-ui` gains `PreviewPane` /
  `usePreviewChannel`, `CollectionForm`'s `onValuesChange` and `onFocusPathChange`
  (the path of the expanded block or array row, via `FocusPathProvider`), and
  `useMediaQuery`.

- [#45](https://github.com/voila-voila-dev/content.voila.dev/pull/45) [`b2432a6`](https://github.com/voila-voila-dev/content.voila.dev/commit/b2432a69e33de22044cb5ad857ca4e25680ba4a6) Thanks [@emilienbidet](https://github.com/emilienbidet)! - `defineAdmin({ nav: { groups } })` lays the sidebar out explicitly — `{ label, items: [slug, …] }` per group, in order (the dashboard tiles follow); entities the layout doesn't list keep their own `group` and declaration order. Also `buildNav({ groups })`, `AppSidebar` / `AdminShell` / `Dashboard` `navGroups`. A host `branding.logo` now fills the sidebar and login marks instead of sitting on the initial's tint.

- [#50](https://github.com/voila-voila-dev/content.voila.dev/pull/50) [`ee7357b`](https://github.com/voila-voila-dev/content.voila.dev/commit/ee7357bdd1cc04f7e5891b5d990e7b2def27dfbb) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Preview toggle and a compact read view for blocks and object arrays.

  - `PreviewToggle`, in the document header whenever a collection has a live
    preview target: shows or hides the pane. The choice is remembered per slug
    (`voila:preview-open:<slug>`, via `usePreviewToggle`). `PreviewSplit` takes
    an `open` prop and keeps the document panel's ancestors identical in both
    states, so hiding the pane never remounts the form or loses unsaved edits.
  - In detail (read) mode, `BlocksDisplay` and `ArrayDisplay` for records no
    longer dump every field of every item: each item is a collapsed native
    `<details>` row — type badge and one-line summary, mirroring the editor's
    rows — that opens to the item's fields (`DisclosureRows`). Compact (cell,
    kanban) output and scalar arrays are unchanged.

### Patch Changes

- [#44](https://github.com/voila-voila-dev/content.voila.dev/pull/44) [`ec459b9`](https://github.com/voila-voila-dev/content.voila.dev/commit/ec459b94cbb33a3561d2002d0c72fee8980dfa30) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Dashboard tiles and `StatCard`: the quick "New" action / icon sits in `Card.Action` on the title row again (the kit's card header is a grid, so `flex-row` no longer aligned it).

- Updated dependencies [[`b288b94`](https://github.com/voila-voila-dev/content.voila.dev/commit/b288b94f92cfb9050c3272fe022fb231ea9fb19e), [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1), [`0b0e6be`](https://github.com/voila-voila-dev/content.voila.dev/commit/0b0e6bea1a30d9399fd40e49eb0d603377810ee0)]:
  - @voila/content@0.4.0

## 0.2.1

### Patch Changes

- Republish of 0.2.0 with `workspace:` / `catalog:` dependency protocols resolved
  (0.2.0 was uninstallable and is deprecated). No code change.

## 0.2.0

### Minor Changes

- **Field groups & cards** — `FieldGroupNav`, `FieldCard`, and grouped layouts in
  `DetailView` / `CollectionForm` (left sub-nav + cards).
- **List views** — `ViewSwitcher` (table/kanban/map + saved-view management, with
  pickers for the kanban group field and map geo field), `ColumnPicker` (toggle +
  drag-to-reorder, with up/down keyboard fallback), `KanbanView`, and `MapView`
  (maplibre-gl, loaded via a WebGL-guarded dynamic import). `maplibre-gl` is an
  **optional peer dependency** — install it to use a map view or the geo picker.
- **`FilterBuilder`** — author the server-side list filters from the UI; its
  fields/operators/value inputs mirror the REST filter gate.
- **Geo edit widget** — `GeoInput` (a dependency-free latitude/longitude pair,
  the default for the `geo` kind) and `createGeoInput({ mapStyleUrl })`, a
  click-to-place / draggable-marker maplibre picker that degrades to the lat/lng
  inputs if maplibre is unavailable.
- **Per-field save** — `CollectionForm` gains `saveMode="field"`: each field is
  its own card with its own Save that submits just that field (a one-key partial;
  a cleared optional sends an explicit `null`).
