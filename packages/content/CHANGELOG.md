# @voila/content

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
