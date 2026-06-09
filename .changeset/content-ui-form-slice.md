---
"@voila/content-ui": minor
---

Add the write half of `@voila/content-ui`: a `CollectionForm` and the edit-widget
registry.

- **Edit widgets** — native form controls (text, textarea, number, boolean
  switch, select, date/datetime/time) that emit *correctly typed* values
  (number, boolean, `Date`, or string) so each value re-validates against its
  field's own Standard Schema. `select`/`enum` map the native string value back
  to the field's original (possibly numeric) type. Kinds without an editor yet
  (array, object, media, relation, richText, …) render an honest, read-only
  `UnsupportedInput` rather than corrupting the value.
- **`defaultEditRegistry` / `resolveEditWidget` / `mergeEditRegistry`** — the
  write-side twin of the display registry, keyed by `meta.widget ?? meta.kind`.
- **`CollectionForm`** — renders a labeled input per non-hidden field (or an
  explicit `fields` subset), validates on submit with `validateFields`, shows
  per-field errors inline plus a form-level `error` slot, and calls `onSubmit`
  with the decoded values only when everything passes.
- **`validateFields`** — mirrors the server's `validateWrite` contract: an empty
  value fails only if the field is required, otherwise it is omitted; a present
  value is checked against the field's Standard Schema. Returns decoded values
  plus a per-field error map (no exceptions).

The display slice's `mergeRegistry` is renamed to `mergeDisplayRegistry` for
symmetry with `mergeEditRegistry` (both delegate to a shared merge helper).

```tsx
import { CollectionForm } from "@voila/content-ui";

<CollectionForm
  collection={config.collections.posts}
  defaultValues={post}
  onSubmit={(values) => client.posts.update(post.id, values)}
/>;
```
