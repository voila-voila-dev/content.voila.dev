---
"@voila/content-ui": minor
"@voila/content-admin": patch
---

Compact array and object editors. An array of objects (`fields.array(fields.object(…))`)
now renders as collapsible cards — drag handle, a one-line summary from the first
text member, move / remove, expanded on demand — the same shell as the blocks
editor (`SortableList`, now shared). An object whose members are a handful of
short scalars (`{ label, href }`, `{ icon, text }`) lays them out inline on one
row instead of stacking them; `layoutFor(shape)` decides. Scalar arrays and
long-form objects keep their layout. The admin widens the edit form to the
`content` measure when the fields on screen include a blocks, array or object
editor (`formWidthFor`).
