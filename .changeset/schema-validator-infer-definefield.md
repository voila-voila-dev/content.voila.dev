---
"@voila/content-schema": minor
---

Add Standard Schema validator derivation, `InferDoc` / `InferField` type helpers, and the
`defineField` extension API.

- `toValidator(field, adapter)` returns a [Standard Schema](https://standardschema.dev/)
  validator from any built-in `FieldDef`. Adapters live at
  `@voila/content-schema/adapters/*`; `zodAdapter` ships at `@voila/content-schema/adapters/zod`
  with `zod` as an optional peer dependency.
- `InferDoc<typeof schema>` and `InferField<F>` map a record of field defs to the TS doc shape,
  splitting required and optional keys based on `required: true`.
- `defineField<Kind, Options, Value, Extras>(kind, build?)` is the lowest-level extension API
  for shipping new field kinds with typed kind-specific props.
