# @voila/content

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

## 0.2.1

### Patch Changes

- Republish of 0.2.0 (the 0.2.0 suite was published with unresolved
  `workspace:` / `catalog:` dependency protocols and deprecated). No code change.

## 0.2.0

### Minor Changes

- **`fields.geo()`** — a `{ lat, lng }` point field (JSON-backed, non-sortable),
  plotted by the admin map view and edited by the geo widget.
- **Server-side list filters** — `?filter=field:op:value`
  (`eq | ne | gt | gte | lt | lte | contains`), AND-ed into the list scope and
  count; `ListParams.filters` on the typed client serializes them.
- **Per-user saved views** — a `voila_views` system table + a `views` sub-API on
  the typed client (`list` / `create` / `update` / `delete`), every method scoped
  to the resolved principal; REST routes under `/:collection/_views`.
- **`ListFilter`'s default generic** is loosened from `unknown` to
  `Record<string, unknown>`, so the untyped `ViewConfig.filters` can name any
  column. `ListParams<Doc>` still passes a concrete `Doc` to constrain `field` to
  that collection's keys.
