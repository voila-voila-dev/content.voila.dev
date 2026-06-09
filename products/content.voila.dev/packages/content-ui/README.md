# @voila/content-ui

Schema-aware admin blocks that read a [`@voila/content`](../content) config and
compose [`@voila/ui`](../../../../packages/ui) primitives. You write a config;
these blocks render the list/detail/edit surfaces with no hand-written columns
or form fields.

## Status

Phase 3 — read/display + write:

- **Widget registries** — map a field's `meta.widget ?? meta.kind` to a widget;
  `mergeDisplayRegistry` / `mergeEditRegistry` override per kind. Display widgets
  cover text/number/boolean/date; edit widgets cover text/textarea/number/
  boolean/select(+enum)/date, with an honest fallback for kinds without an
  editor yet.
- **`FieldRenderer`** — resolves and renders one field value (read).
- **`DataTable`** — builds columns and cells from a collection's fields.
- **`CollectionForm`** — builds inputs from field kinds, validates against each
  field's Standard Schema (`validateFields`, the same contract the REST write
  path enforces), and submits decoded values.

`AdminShell`, `ListView`, and `DetailView` land in later slices.

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
import { DataTable, mergeDisplayRegistry, type DisplayWidget } from "@voila/content-ui";

const Stars: DisplayWidget = ({ value }) => <span>{"★".repeat(Number(value) || 0)}</span>;
<DataTable collection={col} rows={rows} registry={mergeDisplayRegistry({ rating: Stars })} />;
```

A `CollectionForm` builds inputs from the same fields and validates on submit:

```tsx
import { CollectionForm } from "@voila/content-ui";

<CollectionForm
  collection={config.collections.posts}
  defaultValues={post}
  onSubmit={(values) => client.posts.update(post.id, values)}
/>;
```

It only calls `onSubmit` with decoded values once every field passes its
Standard Schema; failures render inline. Override an input with
`mergeEditRegistry({ <kind>: MyInput })`, or pass a custom widget per field via
the config (`fields.string({ widget: "myWidget" })`).
