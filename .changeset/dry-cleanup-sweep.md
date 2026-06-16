---
"@voila/content-ui": patch
"@voila/content-cli": patch
"create-voila": patch
---

DRY cleanup sweep (audit #21):

- `@voila/content-ui`: new shared helpers — `getFieldLabel(key, field)` (the
  `meta.label ?? humanize(key)` fallback used by DataTable / DetailView /
  CollectionForm), an exported `<Empty/>` em-dash marker (now also used by the
  Dashboard counts), a generic `resolveWidget(meta, registry, fallback)`
  backing both `resolveDisplayWidget` and `resolveEditWidget`, and a `Doc`
  type alias replacing the repeated `Record<string, unknown>` document casts.
- `@voila/content-cli`: migration filenames now slug through the canonical
  `slugify` from `@voila/content` (snake_case separators kept; diacritics now
  stripped instead of collapsed to `_`).
- `create-voila`: `toPackageName` delegates to the same canonical `slugify`
  (dots/underscores in directory names now normalize to hyphens).
