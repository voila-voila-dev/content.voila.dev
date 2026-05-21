# @voila/content-schema

Field constructors and the `FieldDef` type that the rest of the CMS hangs off.

```ts
import { fields } from "@voila/content-schema";

const post = {
  title: fields.string({ required: true, min: 1, max: 200 }),
  views: fields.number({ integer: true, min: 0 }),
  draft: fields.boolean({ default: true }),
  publishedAt: fields.datetime(),
  meta: fields.json<{ ogImage?: string }>(),
};
```

Each constructor lives in its own file under `src/fields/` and is re-exported from the package root.
Stubs only — widgets, validator derivation, and `InferDoc` land in later milestones (see [docs/requirements/12-roadmap.md](../../docs/requirements/12-roadmap.md)).

## Validators

Field constraints (`min`, `max`, `pattern`, `format`, …) compile down to a [Standard Schema](https://standardschema.dev/)-compatible validator. **Zod is the default and recommended adapter**, but any Standard Schema implementation — Valibot, ArkType, Effect Schema, etc. — plugs in identically. The schema package itself depends only on the Standard Schema spec; individual adapters live in `@voila/content-schema/adapters/*` so you only pay for the validator you actually use.

## Built-in fields (M0)

| Constructor   | Options                                  |
| ------------- | ---------------------------------------- |
| `string()`    | `min`, `max`, `pattern`, `format`        |
| `number()`    | `min`, `max`, `integer`, `step`          |
| `boolean()`   | —                                        |
| `date()`      | — (date-only ISO 8601)                   |
| `datetime()`  | — (tz-aware ISO 8601)                    |
| `json<T>()`   | typed by generic                         |

All constructors also accept the base `FieldDef` options (`required`, `default`, `unique`, `index`, `localized`, `hidden`, `access`, `validate`, `transform`, …). See [`src/types.ts`](./src/types.ts).
