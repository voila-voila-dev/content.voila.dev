---
"@voila/content-ui": minor
"@voila/content": patch
---

Add `@voila/content-ui` — schema-aware admin blocks that read a
`@voila/content` config and compose `@voila/ui` primitives. This is the Phase 3
read/display slice:

- **Widget registry** — `defaultDisplayRegistry` maps a field's
  `meta.widget ?? meta.kind` to a display widget; `resolveDisplayWidget` always
  returns one (JSON fallback), and `mergeRegistry` layers caller overrides over
  the defaults. Built-in widgets cover text, number, boolean, and date kinds.
- **`FieldRenderer`** — the single composition point that resolves and renders
  one field value, used by table cells (and, later, detail rows).
- **`DataTable`** — builds columns and cells from a collection's fields. Columns
  default to every non-hidden field in declaration order, or pass an explicit
  `columns` list of field keys; cells render through `FieldRenderer`.

`@voila/content` now re-exports the `Field` and `FieldMetaBase` types from its
root so schema-aware UI (and the forthcoming form layer) can type against them
without reaching into internals.

```tsx
import { DataTable } from "@voila/content-ui";

<DataTable
  collection={config.collections.posts}
  rows={posts}
  columns={["title", "publishedAt", "tags"]}
/>;
```

Forms (`CollectionForm`), `AdminShell`, `ListView`, and `DetailView` follow in
later Phase 3 slices.
