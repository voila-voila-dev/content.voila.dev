---
"@voila/content-ui": minor
---

Add `GeoDisplay` — a read-only renderer for `geo` fields that shows the
`{ lat, lng }` point as trimmed `lat, lng` linking out to OpenStreetMap.
Registered for the `geo` kind in `defaultDisplayRegistry`, so geo fields now
render formatted coordinates in `DataTable` / `DetailView` instead of falling
through to the raw-JSON display. Completes the geo field set (field → edit widget
→ display → map view).
