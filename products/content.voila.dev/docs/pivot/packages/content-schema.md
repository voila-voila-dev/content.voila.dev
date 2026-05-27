# @voila/content-schema

> The field runtime: every field is an annotated `effect/Schema` that is simultaneously the type, the validator, the DB column spec, and the UI hint. **World:** Engine. **Layer:** L1. **Status:** M0.

## Responsibility

Owns field constructors, the `VoilaField` annotation namespace, `InferDoc` / `InferField` type utilities, and `defineField` for third-party extensions. Does **not** own resolvers, SQL, HTTP, or any React — it is a pure schema library with no runtime side-effects beyond Schema compilation. It does **not** expose a pluggable validator library: `effect/Schema` is the one schema language; Zod and Standard Schema enter only through `Schema.standardSchemaV1` on the way out to the Head.

## Public API

| Export | Kind | Description |
| --- | --- | --- |
| `string`, `number`, `boolean`, `date`, `datetime`, `json`, `slug`, `select` | Field constructors | Return an annotated `Schema.Schema<T>` carrying voila metadata |
| `defineField` | Function | Register a third-party field kind; returns a typed constructor |
| `VoilaField` | `Schema.Annotation` | Namespace symbol for DB + UI metadata |
| `getFieldMeta` | Function | Read `VoilaField` annotation from any field schema |
| `InferDoc<C, Slug>` | Type utility | Walk a collection's struct to produce the document TypeScript type |
| `InferField<F>` | Type utility | Extract the TS value type from a single field schema |
| `Schema.standardSchemaV1(field)` | Re-export | Produce a Standard-Schema-compliant view for the Head/forms layer |
| `Locale` | Type | `string & Brand<"Locale">` — the locale identifier type used by localized fields in `@voila/content` |

## Effect surface

`effect/Schema` throughout — `Schema.String`, `Schema.Number`, `Schema.annotations`, `Schema.decodeUnknown`, `Schema.encode`. No `Effect`, `Layer`, or `Context.Tag` — this package is pure schema, importable in any context (browser, worker, server).

## Dependencies

- `effect` (core, for `effect/Schema`)
- No other `@voila/*` packages — L1 is the dependency floor.

## Usage

```ts
// content.config.ts  — one field per file is the project convention
import { string, number, boolean, slug, defineField } from "@voila/content-schema"

// Built-in field — annotated Schema, validated by Schema.decodeUnknown
export const title = string({ min: 1, max: 200, label: "Title" })
export const wordCount = number({ min: 0, index: true })
export const published = boolean({ default: false })
export const postSlug = slug({ unique: true, derivedFrom: "title" })

// Infer the document type at the collection level
import type { InferDoc } from "@voila/content-schema"
type Post = InferDoc<typeof posts.fields>
// → { title: string; wordCount?: number; published?: boolean; slug: string }

// Expose a Standard Schema for TanStack Form in the Head
import { Schema } from "effect"
const titleStandard = Schema.standardSchemaV1(title)
```

## Extension points (A′)

`defineField` lets a consumer register a new field kind as a Schema + annotation without touching engine source. The field's annotation drives both the DB column (picked up by `@voila/content-sql`'s DDL generator) and the widget selector (picked up by the vended form layer).

```ts
import { defineField, VoilaField } from "@voila/content-schema"
import { Schema } from "effect"

// A custom "color" field — ships as a third-party npm package or local file
export const color = defineField("color", (opts: ColorOpts) =>
  Schema.String.pipe(
    Schema.pattern(/^#[0-9a-f]{6}$/i),
    Schema.annotations({
      [VoilaField]: { kind: "color", widget: "color-picker", ...opts },
    }),
  )
)
```

## Replaces

`@voila/content-schema` — the current package using hand-rolled `FieldDef` objects, a `ValidatorAdapter` / Zod bridge, and Standard-Schema-based `validateDocument`. The Zod adapter (`src/adapters/zod.ts`) and the `ValidatorAdapter` interface are removed; `effect/Schema` decode takes their place. The `validate`, `transform`, and `access` callbacks on `FieldDef` are modelled as Schema transformations and annotations instead.

## Testing

- **Unit:** every field constructor's decode/encode round-trips and constraint violations, run as plain `bun test` assertions (no Effect runtime needed — `Schema.decodeUnknownSync` is synchronous for built-in types). Target ≥ 90% line coverage (M0 bar).
- **Type:** `InferDoc` and `InferField` checked with `tsd`-style expect-type assertions; ensures the struct inference is correct across required/optional boundaries.
- **Contract:** `Schema.standardSchemaV1` output validated against the Standard Schema spec — confirms the Head still receives a compliant interface.
