---
"@voila/content": minor
"@voila/content-admin": minor
"@voila/content-ui": minor
---

External collections. `defineCollection({ external: true, … })` declares a
collection with no table in the content database: the migrations skip it and
the runtime serves it from a host-provided `CollectionSource` (in
`@voila/content/server`) registered under the slug —
`makeDatabase(config, driver, { sources: { customers } })`. Only `list` and
`get` are mandatory on a source; `findOne`/`create`/`update`/`delete`/`search`
are optional, and a missing one answers `405 NOT_SUPPORTED` (new `ApiFailure`
code; `DatabaseError.unsupported` underneath). REST routes, list filters/sort/
count, saved views and the typed client work unchanged over a source.

Alongside: `operations: { create?, update?, delete? }` on a collection switches
a write operation off (the route answers 405 and the admin hides the matching
UI), and `readOnly: true` on any field makes it display-only — the record form
renders it without an input and the write routes reject a payload naming it
(403 `FORBIDDEN`, like a per-field `access.write` denial); a required readOnly
field is not demanded on create.
