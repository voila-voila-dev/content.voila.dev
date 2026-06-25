# @voila/content-ui

## 0.2.0

### Minor Changes

- **Field groups & cards** — `FieldGroupNav`, `FieldCard`, and grouped layouts in
  `DetailView` / `CollectionForm` (left sub-nav + cards).
- **List views** — `ViewSwitcher` (table/kanban/map + saved-view management, with
  pickers for the kanban group field and map geo field), `ColumnPicker` (toggle +
  drag-to-reorder, with up/down keyboard fallback), `KanbanView`, and `MapView`
  (maplibre-gl, loaded via a WebGL-guarded dynamic import). `maplibre-gl` is an
  **optional peer dependency** — install it to use a map view or the geo picker.
- **`FilterBuilder`** — author the server-side list filters from the UI; its
  fields/operators/value inputs mirror the REST filter gate.
- **Geo edit widget** — `GeoInput` (a dependency-free latitude/longitude pair,
  the default for the `geo` kind) and `createGeoInput({ mapStyleUrl })`, a
  click-to-place / draggable-marker maplibre picker that degrades to the lat/lng
  inputs if maplibre is unavailable.
- **Per-field save** — `CollectionForm` gains `saveMode="field"`: each field is
  its own card with its own Save that submits just that field (a one-key partial;
  a cleared optional sends an explicit `null`).
