# 04 — Schema & Fields

The schema is the program. This doc spells out the field surface.

## Field constructor shape

Every field is a function returning a `FieldDef`:

```ts
type FieldDef<T = unknown> = {
  kind: string                       // 'string' | 'number' | …
  required?: boolean
  default?: T | (() => T)
  unique?: boolean
  index?: boolean
  searchable?: boolean | { weight?: number }
  localized?: boolean                // per-locale storage
  hidden?: boolean | 'list' | 'detail'
  readOnly?: boolean | ((ctx) => boolean)
  access?: {
    read?:   (ctx, doc?) => boolean
    write?:  (ctx, doc?) => boolean
  }
  validate?: (value, ctx) => string | true | Promise<string | true>
  transform?: {
    input?:  (value, ctx) => unknown // before persist
    output?: (value, ctx) => unknown // after load
  }
  widget?: React.ComponentType<WidgetProps>
  cell?:   React.ComponentType<CellProps>
  filter?: 'text' | 'select' | 'range' | 'date' | false
  label?:  string
  description?: string
  group?:  string                    // tab/section in the detail UI
}
```

Every constructor extends this with its own type-specific props.

## Built-in field types

### Primitives

```ts
fields.string({ min, max, pattern, format: 'email' | 'url' | 'uuid' })
fields.number({ min, max, integer, step })
fields.boolean()
fields.date()        // date-only, ISO 8601
fields.datetime()    // tz-aware ISO 8601
fields.time()
```

### Identifiers

```ts
fields.slug({
  from: 'title',          // source field
  unique: true,
  reserved: ['admin', 'api'],
})
fields.id({ format: 'uuid' | 'cuid2' | 'ulid' })  // rarely needed (auto)
```

### Selections

```ts
fields.select({ options: ['draft', 'published', 'archived'] as const })
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

```ts
fields.richText({
  plugins:  [headings, lists, links, codeBlock, mention({ source: 'users' })],
  toolbar:  ['bold', 'italic', 'link', 'image'],
  outputs:  ['html', 'json', 'plaintext'],   // what to expose to clients
})

fields.markdown({ flavor: 'gfm' })
fields.code({ language: 'ts' | 'sql' | 'json' })
fields.color({ format: 'hex' | 'rgb' | 'oklch' })
```

### Media

```ts
fields.media({
  accept: ['image/*'],
  max: 5 * 1024 * 1024,              // bytes
  multiple: false,
  transforms: {                       // generated on upload
    thumb: { width: 200,  height: 200, fit: 'cover', format: 'webp' },
    full:  { width: 1600, quality: 82, format: 'webp' },
  },
})
```

See [09 — Media & Storage](./09-media-storage.md) for the full pipeline.

### Relations

```ts
fields.relation({
  to: 'authors',
  many: false,                       // one-to-one / many-to-one
  onDelete: 'restrict' | 'cascade' | 'setNull',
  filter: (ctx) => ({ active: true }),
})

fields.relation({
  to: 'tags',
  many: true,                        // many-to-many (junction table auto-created)
  through: 'post_tags',              // optional, default auto
})

fields.polymorphic({
  to: ['posts', 'pages'],            // discriminated union
})
```

### Geo / specialized

```ts
fields.geo({ format: 'lngLat' | 'wkt' })
fields.duration()                    // ISO 8601 P1DT2H, stored as seconds
fields.password({ hash: 'argon2id' })// hashed at rest, never returned
fields.secret()                      // encrypted at rest (KV-backed key)
```

## Validation

Three layers, in order:

1. **Static**: constructor params (`min`, `max`, `pattern`) → derived [Standard Schema](https://standardschema.dev/) validator (Zod by default).
2. **Field-level**: `validate(value, ctx)` for cross-field logic.
3. **Doc-level**: `collection.validate(doc, ctx)` for whole-document invariants.

Errors bubble up to the form as field-level messages. Doc-level errors render as a banner.

### Validator library

The static layer compiles each field's constraints into a Standard Schema-compatible validator. Zod is the default — it's what `@voila/content-schema` ships with and what every example in these docs uses. But Standard Schema is a spec, not a vendor: you can plug in Valibot, ArkType, Effect Schema, or any other [Standard Schema](https://standardschema.dev/) implementation.

```ts
// content.config.ts
import { defineContent } from '@voila/content'
import { valibotAdapter } from '@voila/content-schema/adapters/valibot'

export default defineContent({
  validator: valibotAdapter(),   // optional; defaults to Zod
  collections: [posts, authors],
})
```

Field-level `validate(value, ctx)` runs after the static layer, regardless of which library you pick — it's a plain function, not a schema.

```ts
fields.string({
  validate: (value, { doc }) => {
    if (doc.kind === 'short' && value.length > 280) return 'Too long for short posts'
    return true
  },
})
```

## Transformation

Two hooks per field:

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
// stored as: { 'en-US': 'Hello', 'fr-FR': 'Bonjour', 'it-IT': 'Ciao' }
```

The admin shows a locale tab strip on the field. The public API returns the requested locale (`?locale=fr-FR`) or the fallback chain. Locale identifiers follow [BCP 47](https://www.rfc-editor.org/info/bcp47) (`en-US`, `fr-FR`, `pt-BR`, `zh-Hant-TW`, …) — see [13 — i18n with Paraglide & Inlang](./13-i18n-paraglide.md#locale-tags).

`localized` fields are **pillar 2** of the i18n model — dynamic content like a post's title in five languages. For static UI strings on your site (`"Submit"`, `"Cart is empty"`), use the built-in **Messages** section (pillar 3) instead — different shape, different UX, different sync story. See [13 — i18n with Paraglide & Inlang](./13-i18n-paraglide.md).

## Hidden + access

```ts
internalNotes: fields.string({
  hidden: true,                        // never in list view
  access: {
    read:  (ctx) => ctx.user.role === 'editor',
    write: (ctx) => ctx.user.role === 'editor',
  },
})
```

Hidden fields are excluded from the public REST output unless the requester has read access. RBAC is enforced at the query layer (Drizzle middleware), not the API surface — so MCP, REST, and the admin all share the same enforcement.

## Custom fields

A custom field is just a function returning a `FieldDef`:

```ts
// fields/rating.ts
import { fields, type FieldDef } from '@voila/schema'

export function rating(opts: { max?: number } = {}): FieldDef<number> {
  return fields.number({
    min: 0,
    max: opts.max ?? 5,
    integer: true,
    widget: RatingStarsWidget,
    cell: RatingStarsCell,
    filter: 'range',
  })
}
```

Use it like any built-in field. No registration step.

## Inference

```ts
import type { InferDoc } from '@voila/content'
import config from '~/content.config'

type Post = InferDoc<typeof config, 'posts'>
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

---

Continue → [05 — Collections & Singletons](./05-collections-singletons.md)
