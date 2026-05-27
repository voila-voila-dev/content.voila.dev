# 04 — Schema & Fields

The schema is the program. This doc spells out the field surface.

## Field constructor shape

A field **is** an `effect/Schema` carrying voila metadata in its annotations. One object is simultaneously the type, the validator (decode/encode), the DB column spec, and the UI hint. There is no separate `FieldDef` type.

```ts
// conceptual shape — constructors live in @voila/content-schema
import { Schema } from "effect"

// what a constructor returns: an annotated Schema
export const string = (opts?: StringOpts) =>
  Schema.String.pipe(
    opts?.min !== undefined ? Schema.minLength(opts.min) : identity,
    opts?.max !== undefined ? Schema.maxLength(opts.max) : identity,
    Schema.annotations({
      [VoilaField]: {
        kind: "string",
        unique: opts?.unique,
        widget: "string",
        // … DB column spec, UI hints
      },
    }),
  )
```

Every constructor accepts type-specific options and returns an annotated Schema. The annotations drive DB column derivation, migration generation, and admin widget selection.

## Built-in field types

### Primitives

```ts
import { fields } from "@voila/content-schema"

fields.string({ min, max, pattern, format: "email" | "url" | "uuid" })
fields.number({ min, max, integer, step })
fields.boolean()
fields.date()        // date-only, ISO 8601
fields.datetime()    // tz-aware ISO 8601
fields.time()
```

### Identifiers

```ts
fields.slug({
  from: "title",          // source field
  unique: true,
  reserved: ["admin", "api"],
})
fields.id({ format: "uuid" | "cuid2" | "ulid" })  // rarely needed (auto)
```

### Selections

```ts
fields.select({ options: ["draft", "published", "archived"] as const })
fields.multiSelect({ options: tagOptions })
fields.enum(StatusEnum)              // re-uses a TS enum/const
```

### Structured

```ts
fields.array(
  fields.string(),
  { min: 1, max: 10 }
)

fields.object({
  street: fields.string(),
  city:   fields.string(),
  zip:    fields.string({ pattern: /^\d{5}$/ }),
})

fields.json<MyShape>()               // free-form, typed by generic
fields.tuple([fields.number(), fields.number()])  // e.g. [lat, lng]
```

### Rich content

Powered by `@voila/rich-text-editor` (behavior) and its `@voila/rich-text-editor/nodes` subpath (the default node components). Both are pass-through, so you extend plugins or swap any node's rendering without forking — see [03 — DX §f](./03-dx.md#f-custom-rich-text-plugins--node-rendering).

```ts
fields.richText({
  plugins:    [headings, lists, links, codeBlock, mention({ source: "users" })],
  components: { [H1Plugin.key]: MyHeading },  // override node rendering (optional)
  toolbar:    ["bold", "italic", "link", "image"],
  outputs:    ["html", "json", "plaintext"],  // what to expose to clients
})

fields.markdown({ flavor: "gfm" })
fields.code({ language: "ts" | "sql" | "json" })
fields.color({ format: "hex" | "rgb" | "oklch" })
```

### Media

```ts
fields.media({
  accept: ["image/*"],
  max: 5 * 1024 * 1024,              // bytes
  multiple: false,
  transforms: {                       // generated on upload
    thumb: { width: 200,  height: 200, fit: "cover", format: "webp" },
    full:  { width: 1600, quality: 82, format: "webp" },
  },
})
```

See [09 — Media & Storage](./09-media-storage.md) for the full pipeline.

### Relations

```ts
fields.relation({
  to: "authors",
  many: false,                       // one-to-one / many-to-one
  onDelete: "restrict" | "cascade" | "setNull",
  filter: (ctx) => ({ active: true }),
})

fields.relation({
  to: "tags",
  many: true,                        // many-to-many (junction table auto-created)
  through: "post_tags",              // optional, default auto
})

fields.polymorphic({
  to: ["posts", "pages"],            // discriminated union
})
```

### Geo / specialized

```ts
fields.geo({ format: "lngLat" | "wkt" })
fields.duration()                    // ISO 8601 P1DT2H, stored as seconds
fields.password({ hash: "argon2id" })// hashed at rest, never returned
fields.secret()                      // encrypted at rest (KV-backed key)
```

## Validation

`effect/Schema` is the one schema language. There is no pluggable validator library, no Zod, no adapter. Validation is:

- **`Schema.decodeUnknown`** — parse/validate incoming data (HTTP request body, form submit, import).
- **`Schema.encode`** — serialize for persistence.

The **same** schema instance runs on client and server. There is no separate "server copy" — the single source of truth is the annotated Schema in `@voila/content-schema`.

`effect/Schema` is itself Standard-Schema-compliant via `Schema.standardSchemaV1`, so the Head (TanStack Form, vended form components) speaks a standard contract without knowing Effect.

### Field-level cross-field logic

Use `Schema.filter` on the field schema, or a doc-level filter on the collection struct:

```ts
// field-level
fields.string().pipe(
  Schema.filter((value, { doc }) => {
    if (doc.kind === "short" && value.length > 280)
      return "Too long for short posts"
    return true
  }),
)
```

Errors bubble up to the form as field-level messages. Doc-level errors render as a banner.

## Transformation

Two annotation hooks per field (carried in field annotations, applied by the engine):

```ts
fields.string({
  transform: {
    input:  (v) => v.trim(),            // before persist
    output: (v) => v.toUpperCase(),     // after load (rare)
  },
})
```

Collection-level hooks (see [05](./05-collections-singletons.md)) handle multi-field transforms, before/after persist, etc.

## Localization

`localized: true` flips the storage shape for that field:

```ts
title: fields.string({ localized: true, required: true })
// stored as: { "en-US": "Hello", "fr-FR": "Bonjour", "it-IT": "Ciao" }
```

The admin shows a locale tab strip on the field. The public API returns the requested locale (`?locale=fr-FR`) or the fallback chain. Locale identifiers follow [BCP 47](https://www.rfc-editor.org/info/bcp47) (`en-US`, `fr-FR`, `pt-BR`, `zh-Hant-TW`, …) — see [13 — i18n with Paraglide & Inlang](./13-i18n-paraglide.md#locale-tags).

`localized` fields are **pillar 2** of the i18n model — dynamic content like a post's title in five languages. For static UI strings on your site (`"Submit"`, `"Cart is empty"`), use the built-in **Messages** section (pillar 3) instead — different shape, different UX, different sync story. See [13 — i18n with Paraglide & Inlang](./13-i18n-paraglide.md).

## Hidden + access

```ts
internalNotes: fields.string({
  hidden: true,                        // never in list view
  access: {
    read:  (ctx) => ctx.user.role === "editor",
    write: (ctx) => ctx.user.role === "editor",
  },
})
```

Hidden fields are excluded from the public REST output unless the requester has read access. RBAC is enforced by `RbacService` at the query layer — so MCP, REST, and the admin all share the same enforcement.

## Custom fields

A custom field is a function returning an annotated Schema — the same shape as any built-in:

```ts
// fields/rating.ts
import { fields } from "@voila/content-schema"
import { Schema } from "effect"

export function rating(opts: { max?: number } = {}) {
  return fields.number({ min: 0, max: opts.max ?? 5, integer: true }).pipe(
    Schema.annotations({
      [VoilaField]: {
        widget: "rating-stars",   // widget key registered in the Head
        filter: "range",
      },
    }),
  )
}
```

Use it like any built-in field. No registration step beyond declaring the widget in the vended widget layer.

## Inference

```ts
import type { InferDoc } from "@voila/content-schema"
import config from "~/content.config"

type Post = InferDoc<typeof config, "posts">
// ^? {
//      id: string
//      title: string
//      slug: string
//      body: { html: string; json: SlateNode[]; plaintext: string }
//      cover: Media | null
//      tags: string[]
//      publishedAt: Date | null
//    }
```

`InferDoc` walks the collection's struct of field Schemas and resolves each field's `Schema.Schema.Type`, producing the plain TypeScript document type.

---

Continue → [05 — Collections & Singletons](./05-collections-singletons.md)
