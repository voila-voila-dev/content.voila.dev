# @voila/content-schema

## 0.1.0

### Minor Changes

- Initial release of `@voila/content-schema`.

  - `FieldDef<T>` base type plus supporting types (`FieldContext`, `FieldAccess`, `FieldTransform`, `FieldValidate`, `FieldFilter`, `FieldHidden`).
  - Stub field constructors: `string`, `number`, `boolean`, `date`, `datetime`, `json<T>()`.
  - `fields` registry barrel.

  Widgets, validator derivation (any [Standard Schema](https://standardschema.dev/) library — Zod by default), and `InferDoc` are deferred to later milestones.
