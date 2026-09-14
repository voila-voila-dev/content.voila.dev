---
"@voila/content": minor
"@voila/content-ui": minor
"@voila/content-admin": minor
"@voila/content-cli": patch
---

Add `fields.blocks({ types })` — an ordered, polymorphic list of `{ type, ...fields }` records (the page-builder primitive) — with generic edit and display widgets for `blocks`, `object` and `array`.

- `array` / `object` metas now carry the nested fields (`meta.item` / `meta.shape`), so the admin renders one widget per member; nested fields resolve through the registry in scope (`EditRegistryProvider` / `useEditRegistry`), so host-injected media, relation and rich-text widgets work inside a block.
- `CollectionForm` surfaces nested validation issues under the nested control (`EditWidgetProps.issues`, `validateFields().issues`); the field-level message and the client's `issuesByField` keep the sub-path (`[2].title: Required.`).
- The DDL deriver stores `blocks` as JSON and now ships `voila_media` when the only media field is nested.
- `FieldRow` (the label / help / error chrome of one field) and `NestedFields` are exported.
- Breaking for `fields.object`: members that are voila fields follow the write path's blank rule — an empty optional member is omitted instead of failing. Mark members `required: true` to keep them mandatory.
