# @voila/content-cli

## 0.4.0

### Patch Changes

- [#43](https://github.com/voila-voila-dev/content.voila.dev/pull/43) [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1) Thanks [@emilienbidet](https://github.com/emilienbidet)! - Add `fields.blocks({ types })` — an ordered, polymorphic list of `{ type, ...fields }` records (the page-builder primitive) — with generic edit and display widgets for `blocks`, `object` and `array`.

  - `array` / `object` metas now carry the nested fields (`meta.item` / `meta.shape`), so the admin renders one widget per member; nested fields resolve through the registry in scope (`EditRegistryProvider` / `useEditRegistry`), so host-injected media, relation and rich-text widgets work inside a block.
  - `CollectionForm` surfaces nested validation issues under the nested control (`EditWidgetProps.issues`, `validateFields().issues`); the field-level message and the client's `issuesByField` keep the sub-path (`[2].title: Required.`).
  - The DDL deriver stores `blocks` as JSON and now ships `voila_media` when the only media field is nested.
  - `FieldRow` (the label / help / error chrome of one field) and `NestedFields` are exported.
  - Breaking for `fields.object`: members that are voila fields follow the write path's blank rule — an empty optional member is omitted instead of failing. Mark members `required: true` to keep them mandatory.

- Updated dependencies [[`b288b94`](https://github.com/voila-voila-dev/content.voila.dev/commit/b288b94f92cfb9050c3272fe022fb231ea9fb19e), [`f939f69`](https://github.com/voila-voila-dev/content.voila.dev/commit/f939f69fc6c97d44123c676b3563068c84b079b1), [`0b0e6be`](https://github.com/voila-voila-dev/content.voila.dev/commit/0b0e6bea1a30d9399fd40e49eb0d603377810ee0)]:
  - @voila/content@0.4.0

## 0.2.1

### Patch Changes

- Republish of 0.2.0 with the `workspace:` dependency protocol resolved (0.2.0
  was uninstallable and is deprecated). No code change.

## 0.2.0

### Minor Changes

- Version-aligned with the `@voila/content` suite (no functional change). The CLI
  scaffolds and migrates projects on `@voila/content@0.2.0`.
