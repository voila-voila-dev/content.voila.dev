---
"@voila/content-admin": minor
"@voila/content-ui": minor
---

Preview toggle and a compact read view for blocks and object arrays.

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
