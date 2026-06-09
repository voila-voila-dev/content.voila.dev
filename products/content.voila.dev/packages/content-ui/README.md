# @voila/content-ui

Schema-aware admin blocks that read a [`@voila/content`](../content) config and
compose [`@voila/ui`](../../../../packages/ui) primitives. You write a config;
these blocks render the list/detail/edit surfaces with no hand-written columns
or form fields.

## Status

Phase 3, read/display slice:

- **Widget registry** — maps a field's `meta.widget ?? meta.kind` to a display
  widget; `mergeRegistry` lets you override per kind.
- **`FieldRenderer`** — resolves and renders one field value.
- **`DataTable`** — builds columns and cells from a collection's fields.

Forms (`CollectionForm`), `AdminShell`, `ListView`, and `DetailView` land in
later slices.

## Example

```tsx
import { DataTable } from "@voila/content-ui";

<DataTable
  collection={config.collections.posts}
  rows={posts}
  columns={["title", "publishedAt", "tags"]}
/>;
```

Columns default to every non-hidden field. Override a kind's renderer:

```tsx
import { DataTable, mergeRegistry, type DisplayWidget } from "@voila/content-ui";

const Stars: DisplayWidget = ({ value }) => <span>{"★".repeat(Number(value) || 0)}</span>;
<DataTable collection={col} rows={rows} registry={mergeRegistry({ rating: Stars })} />;
```
