# @voila/content-admin

## 0.4.0

### Minor Changes

- [#42](https://github.com/voila-voila-dev/content.voila.dev/pull/42) [`b288b94`](https://github.com/voila-voila-dev/content.voila.dev/commit/b288b94f92cfb9050c3272fe022fb231ea9fb19e) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Collection-backed admin allowlist. `allowlistAccess({ collection, field })` (in
  `@voila/content/server`) admits the emails listed in one of your own collections
  — by default `admins.email`, declared with `defineAdminsCollection()` — instead
  of the first-user-wins default. The admin runtime now resolves access _policies_:
  `createWorkerAdmin(config, { access: allowlistAccess() })` gates magic-link
  sign-in (unknown addresses get a 403 before any email is sent) and exposes
  `runtime.policy.admits` for the host's route guard via `resolveAdmission`.

- [#43](https://github.com/voila-voila-dev/content.voila.dev/pull/43) [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Add `fields.blocks({ types })` — an ordered, polymorphic list of `{ type, ...fields }` records (the page-builder primitive) — with generic edit and display widgets for `blocks`, `object` and `array`.

  - `array` / `object` metas now carry the nested fields (`meta.item` / `meta.shape`), so the admin renders one widget per member; nested fields resolve through the registry in scope (`EditRegistryProvider` / `useEditRegistry`), so host-injected media, relation and rich-text widgets work inside a block.
  - `CollectionForm` surfaces nested validation issues under the nested control (`EditWidgetProps.issues`, `validateFields().issues`); the field-level message and the client's `issuesByField` keep the sub-path (`[2].title: Required.`).
  - The DDL deriver stores `blocks` as JSON and now ships `voila_media` when the only media field is nested.
  - `FieldRow` (the label / help / error chrome of one field) and `NestedFields` are exported.
  - Breaking for `fields.object`: members that are voila fields follow the write path's blank rule — an empty optional member is omitted instead of failing. Mark members `required: true` to keep them mandatory.

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

- [#48](https://github.com/voila-voila-dev/content.voila.dev/pull/48) [`d83354d`](https://github.com/voila-voila-dev/content.voila.dev/commit/d83354d633dc98aded04b4e96ab9a5d41b3eb9f8) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Compact array and object editors. An array of objects (`fields.array(fields.object(…))`)
  now renders as collapsible cards — drag handle, a one-line summary from the first
  text member, move / remove, expanded on demand — the same shell as the blocks
  editor (`SortableList`, now shared). An object whose members are a handful of
  short scalars (`{ label, href }`, `{ icon, text }`) lays them out inline on one
  row instead of stacking them; `layoutFor(shape)` decides. Scalar arrays and
  long-form objects keep their layout. The admin widens the edit form to the
  `content` measure when the fields on screen include a blocks, array or object
  editor (`formWidthFor`).
- Updated dependencies [[`b288b94`](https://github.com/voila-voila-dev/content.voila.dev/commit/b288b94f92cfb9050c3272fe022fb231ea9fb19e), [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1), [`d83354d`](https://github.com/voila-voila-dev/content.voila.dev/commit/d83354d633dc98aded04b4e96ab9a5d41b3eb9f8), [`ec459b9`](https://github.com/voila-voila-dev/content.voila.dev/commit/ec459b94cbb33a3561d2002d0c72fee8980dfa30), [`0b0e6be`](https://github.com/voila-voila-dev/content.voila.dev/commit/0b0e6bea1a30d9399fd40e49eb0d603377810ee0), [`d3915c0`](https://github.com/voila-voila-dev/content.voila.dev/commit/d3915c00b43f3c3dfb36a588a323880df1c28dcb), [`b2432a6`](https://github.com/voila-voila-dev/content.voila.dev/commit/b2432a69e33de22044cb5ad857ca4e25680ba4a6), [`ee7357b`](https://github.com/voila-voila-dev/content.voila.dev/commit/ee7357bdd1cc04f7e5891b5d990e7b2def27dfbb)]:
  - @voila/content@0.4.0
  - @voila/content-ui@0.4.0

## 0.2.1

### Patch Changes

- Republish of 0.2.0 with `workspace:` / `catalog:` dependency protocols resolved
  (0.2.0 was uninstallable and is deprecated). No code change.

## 0.2.0

### Minor Changes

- **Saved views, kanban & map** wired into the config-driven admin: the list
  screen loads/persists per-user views, dispatches on view type, and offers a
  `FilterBuilder`, kanban group-field and map geo-field pickers.
- **Geo map picker by default** — `defineAdmin` injects
  `createGeoInput({ mapStyleUrl })` into the edit registry (host `widgets.edit.geo`
  still overrides), so geo fields get a map picker out of the box.
- **Per-field save for grouped collections** — the detail screen edits grouped
  collections with `saveMode="field"` (each card patches its own field via the
  PATCH `update`) and stays in edit mode across saves, with an explicit Done.
- **Self-contained local-dev auth** — `createWorkerAdmin({ dev })` drops a pinned
  `VOILA_BASE_URL` in development so Better Auth infers the origin (and magic-link
  verify URLs) per request. Pass `dev: import.meta.env.DEV` from
  `app/lib/server.ts`; the production build keeps the pinned origin.
