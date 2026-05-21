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
Widgets land in M2 (see [docs/requirements/12-roadmap.md](../../docs/requirements/12-roadmap.md)); validator derivation, `InferDoc`, and `defineField` are available now.

## Validators

Field constraints (`min`, `max`, `pattern`, `format`, …) compile down to a [Standard Schema](https://standardschema.dev/)-compatible validator. **Zod is the default and recommended adapter**, but any Standard Schema implementation — Valibot, ArkType, Effect Schema, etc. — plugs in identically. The schema package itself depends only on the Standard Schema spec; individual adapters live in `@voila/content-schema/adapters/*` so you only pay for the validator you actually use.

```ts
import { string, toValidator } from "@voila/content-schema";
import { zodAdapter } from "@voila/content-schema/adapters/zod";

const title = string({ required: true, min: 1, max: 200 });
const validator = toValidator(title, zodAdapter);

const result = await validator["~standard"].validate("Hello");
// → { value: "Hello" }   (or { issues: [...] } on failure)
```

## Inferring TS types

```ts
import { type InferDoc, json, number, string } from "@voila/content-schema";

const postSchema = {
  title: string({ required: true }),
  views: number(),
  meta: json<{ ogImage?: string }>(),
};

type Post = InferDoc<typeof postSchema>;
// ^? { title: string; views?: number; meta?: { ogImage?: string } }
```

## Custom fields

`defineField` is the lowest-level extension API. Most custom fields just delegate to a built-in
constructor, but `defineField` is there when you need a fresh `kind` with its own type-specific
options:

```ts
import { defineField } from "@voila/content-schema";

export const rating = defineField<
  "rating",                 // kind
  { max?: number },         // caller options
  number,                   // stored value type
  { max: number }           // extra props on the FieldDef (typed)
>("rating", (opts) => ({
  max: opts.max ?? 5,
  default: 0,
  required: true,
}));

const stars = rating({ max: 10 });
// stars.kind === "rating"
// stars.max  === 10           ← typed, no cast
```

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
