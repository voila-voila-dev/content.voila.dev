# 13 — i18n with Paraglide & Inlang

i18n in `content.voila.dev` is **three distinct things**, kept separate. Conflating them is the #1 reason CMS i18n stories rot. We don't.

## The three things

| # | Thing                                  | Where it lives                            | Who edits                              | How                                                    |
| - | -------------------------------------- | ----------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| 1 | **Admin UI strings**                   | `@voila/content-registry` package repo (committed) | OSS contributors                       | PR / Fink / Sherlock                                   |
| 2 | **Localized field values**             | Your DB (per-field, opt-in)               | Editors (web users)                    | Admin UI, locale tabs on the field                     |
| 3 | **Messages** (static site UI strings)  | Your DB **and** your project's repo (synced) | Editors **and** developers           | Admin UI + `voila i18n pull / push`                   |

That's the whole model.

Pillar 1 is shipped with the vended registry items — you never touch it unless contributing translations. Pillar 2 is **dynamic content**: a post's title in five languages. Pillar 3 is **static UI copy on your consuming site**: `"Submit"`, `"Cart is empty"`, `"Welcome back, %name%"`.

Pillars 2 and 3 both live in your DB, but they're modeled differently because they're different shapes:

- A **localized field** belongs to a record (a Post has a title). The locale dimension is one axis among many.
- A **message** is a flat `key → { per-locale value }` entry. There is no parent record. There is no schema beyond key/values/description/tags.

Both flow out through the typed API. Only pillar 3 also syncs with disk files for Paraglide compile.

## Locale tags

All locale identifiers use **[BCP 47](https://www.rfc-editor.org/info/bcp47)**:

- ✅ `'en-US'`, `'fr-FR'`, `'pt-BR'`, `'es-MX'`, `'zh-Hant-TW'`, `'sr-Latn-RS'`
- ❌ `'en'`, `'fr'`, `'pt_BR'`

### Statically typed `Locale` union

`@voila/content-schema` exports a `Locale` type that is the **literal union of every CLDR locale tag** (≈ 700). It's the only string the framework accepts anywhere a locale is expected — `i18n.locales`, `defaultLocale`, `fallback` keys, `?locale=…`, the typed client's `{ locale }`, the localized-field storage shape, the MCP tools, the admin cookie.

```ts
import type { Locale } from '@voila/content-schema'

const fr: Locale = 'fr-FR'      // ✅
const xx: Locale = 'foo-BAR'    // ❌  Type 'foo-BAR' is not assignable to type Locale
```

The union is generated at package build-time from CLDR and shipped as `.d.ts`. Zero runtime cost: the JS side keeps a `Set<string>` for validating untrusted input.

```ts
i18n: {
  locales: ['en-US', 'fr-FR', 'it-IT', 'pt-BR'] as const,
  defaultLocale: 'en-US',
  fallback: {
    'fr-FR': ['en-US'],
    'it-IT': ['en-US'],
    'pt-BR': ['en-US'],
  },
}
```

`defineContent` constrains `defaultLocale` and every fallback chain entry to members of *your* `locales` tuple — so changing one locale flags every downstream reference in the editor.

### Validating untrusted strings

```ts
import { isLocale, parseAcceptLanguage, negotiate } from '@voila/content'

isLocale('fr-FR')                                      // true
isLocale('fr_FR')                                      // false
parseAcceptLanguage('fr-FR;q=0.9, en;q=0.8')           // ['fr-FR', 'en']  (valid only)
negotiate({
  requested: req.headers.get('accept-language'),
  available: config.i18n.locales,
  fallback:  config.i18n.defaultLocale,
})                                                      // 'fr-FR'
```

---

## 1) Admin UI strings

The admin SPA is itself translated. Strings live inside the `@voila/content-registry` package alongside the vended source:

```
packages/registry/
├── inlang/
│   ├── project.inlang/settings.json
│   └── messages/
│       ├── en-US.json
│       ├── fr-FR.json
│       ├── it-IT.json
│       ├── ja-JP.json
│       └── …  (~15 base locales shipped)
└── src/admin/paraglide/   ← compiled at package build, bundled into the vended SPA
```

A locale picker lives above the user menu in the sidebar footer. Selection persists in the `voila_admin_locale` cookie. **Independent of the site's locale** — an English-speaking admin can edit French site content.

### Contributing translations

Standard Inlang workflow — open `packages/registry/inlang/` in [Fink](https://inlang.com/m/tdozzpar/app-inlang-finkLocalizationEditor) or VS Code [Sherlock](https://inlang.com/m/r7kp499g/app-inlang-ideExtension), edit, PR. CI's `voila i18n check` blocks merges that leave a locale incomplete relative to `en-US`.

### Per-app overrides (don't fork)

```ts
defineContent({
  ui: {
    messages: {
      'en-US': { action_create: 'New' },
      'fr-FR': { sidebar_dashboard: 'Tableau de bord' },
    },
  },
})
```

Resolution order: `override → shipped → defaultLocale ('en-US')`.

---

## 2) Localized field values

For any field on any collection or singleton, set `localized: true`. Under the hood, a localized field is an `effect/Schema` whose storage shape is `{ [locale: Locale]: T }` — the locale dimension is encoded in the field's annotations and compiled to the appropriate DB column layout by `@voila/content-sql`.

```ts
title: fields.string({ localized: true, required: true })
// stored as: { 'en-US': 'Hello', 'fr-FR': 'Bonjour', 'it-IT': 'Ciao' }
```

In the admin, that field gets a locale tab strip. Fallback values render as a watermark from the default locale.

A given collection can mix localized and non-localized fields freely:

```ts
defineCollection({
  slug: 'posts',
  fields: {
    title: fields.string({ localized: true, required: true }),   // ← per-locale
    body:  fields.richText({ localized: true }),                  // ← per-locale
    slug:  fields.slug({ from: 'title' }),                         // ← shared across locales
    cover: fields.media(),                                         // ← shared
    author: fields.relation({ to: 'users' }),                      // ← shared
    publishedAt: fields.datetime(),                                // ← shared
  },
})
```

### Consuming from your app

```ts
const post = await client.posts.findOne(
  { slug: 'hello' },
  { locale: 'fr-FR' }
)
post.title   // string (resolved to fr-FR with fallback chain)
post.cover   // shared, returned as-is
```

Same shape from REST: `GET /admin/api/posts/hello?locale=fr-FR`.

This is **dynamic content**. There is no disk file for it — it lives in the DB, served by the API. Paraglide is not involved.

---

## 3) Messages — static UI strings of your site

A built-in, top-level section of voila — **sibling to Collections, Singletons, and Media.** Open `/admin/messages` in the admin.

### Why it's its own thing (not a singleton)

A singleton is one structured document with typed fields. A message catalog is a flat `key → { per-locale value }` namespace, hundreds or thousands of entries, with its own UX needs: search by key/value/description, filter by per-locale completeness, bulk import/export, namespace grouping. Forcing it into a singleton or a collection would lose all of that.

### Data model

```
voila_messages
  key          string  unique        e.g.  'cart.empty.title'
  description  string  optional      shown to translators as context
  values       jsonb                 { 'en-US': '...', 'fr-FR': '...' }
  tags         string[] optional     for grouping in the admin
  updatedAt    timestamp
```

The message-sync Service — owned by `@voila/content-cli` and surfaced as the `voila i18n pull / push` commands — reads and writes this table. (Localized *field* storage, by contrast, is handled inside `@voila/content` + `@voila/content-sql`; there is no separate `i18n` package.)

### Editor workflow (web)

The admin's Messages page provides:

- Search by key, value, or description
- Filter by locale completeness ("fr-FR < 50% complete")
- Add a key + description + initial values
- Edit any value with a locale tab strip (same UX as localized fields)
- Bulk paste from a JSON dict
- Tag for grouping ("ui", "forms", "errors", "marketing")

### Developer workflow — sync with `messages/*.json`

This is the part that lets you use your CMS-managed strings from **any** framework (Astro, TanStack Start, Next, SvelteKit, Solid, Vue — anything that speaks Inlang's format).

```bash
voila i18n pull            # DB → ./messages/*.json   (and ./project.inlang/)
voila i18n push            # ./messages/*.json → DB
voila i18n status          # show the diff (ahead / behind / conflicts)
voila i18n watch           # auto-pull on admin change (SSE)
voila i18n check           # CI: missing-translation report, exits non-zero on drift
```

Both `pull` and `push` are **non-destructive merges**:

- Keys present only in the DB → flagged as "behind" by `status`; `pull` brings them in.
- Keys present only on disk → flagged as "ahead"; `push` sends them up.
- Same key, different values → flagged as a conflict. Resolve with `--strategy=theirs|mine|prompt`.

The CLI writes both the `messages/{locale}.json` files **and** the `project.inlang/settings.json` Inlang project file — so the next tool in your pipeline (Paraglide compile, Fink, Sherlock) just works.

### Configuration

```ts
defineContent({
  i18n: {
    messages: {
      dir:        './messages',           // where to read/write locale files
      project:    './project.inlang',     // Inlang project (auto-managed)
      namespaces: ['ui', 'forms', 'errors', 'marketing'],   // optional
    },
  },
})
```

If `i18n.messages` is omitted, the Messages section is still available in the admin — sync just isn't wired to the filesystem. Useful when the CMS is the only consumer.

### Direction of work — both supported

**Code-first** (dev adds a key the translators then fill in):

1. Dev writes `m.cart_empty_title()` in the site code. Paraglide compile warns: missing key.
2. Dev adds `"cart.empty.title": "Your cart is empty"` to `messages/en-US.json`.
3. `voila i18n push` uploads it. Translators see it in the admin.
4. Translators fill in `fr-FR`, `it-IT`, …
5. Before deploy: `voila i18n pull && paraglide compile`.

**Editor-first** (translator adds a key in the admin first):

1. Editor adds `cart.empty.subtitle` in the admin with values across all locales.
2. Dev runs `voila i18n pull` → it lands in `messages/*.json`.
3. Dev uses `m.cart_empty_subtitle()` in the code.

The DB and the files converge no matter which direction work starts in.

### Using messages from any framework

Once pulled, the files are standard Inlang JSON.

**TanStack Start:**

```bash
voila i18n pull && bunx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
```

```ts
import * as m from '~/paraglide/messages'
import { setLocale } from '~/paraglide/runtime'
<button>{m.cart_checkout()}</button>
```

**Astro:**

```bash
voila i18n pull && bunx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
```

```astro
---
import * as m from '../paraglide/messages'
---
<button>{m.cart_checkout()}</button>
```

**SvelteKit, Next, Solid, Vue, anything Paraglide supports** — identical. The CMS produces Inlang files; the rest is your framework's adapter.

**Don't want Paraglide?** The files are JSON dictionaries. Use them with `i18next`, `react-intl`, FormatJS, `vue-i18n`, anything. Or fetch them at runtime: `GET /admin/api/messages?locale=fr-FR` returns the same data:

```json
{
  "cart.empty.title": "Your cart is empty",
  "cart.checkout":    "Checkout"
}
```

### Build pipeline

A typical project script (any framework):

```json
{
  "scripts": {
    "i18n":   "voila i18n pull && paraglide-js compile",
    "dev":    "bun run i18n && vite",
    "build":  "bun run i18n && vite build",
    "i18n:check": "voila i18n check --fail-on=drift"
  }
}
```

`voila i18n watch` in dev keeps `messages/` in sync as editors work. Paraglide's own watcher then recompiles. HMR closes the loop.

### CI

Recommended jobs:

```yaml
- run: voila i18n check --fail-on=missing,conflicts
- run: voila i18n status --format=json > i18n-status.json   # for review comments
```

`voila i18n check` exits non-zero if:

- any locale is missing keys present in `defaultLocale` (`--fail-on=missing`)
- there are unresolved conflicts (`--fail-on=conflicts`)
- the on-disk catalog has diverged from the DB (`--fail-on=drift`)

Each flag is opt-in — pick the policy that matches how your team works.

---

## Putting it together: what an editor and a developer each touch

**Editor (web user):**

- Opens the admin in their preferred locale (pillar 1).
- Edits posts/products in the admin, switching locale tabs on individual fields (pillar 2).
- Edits site UI copy in the **Messages** section (pillar 3).

**Developer:**

- Adds `import * as m from '~/paraglide/messages'` to their site. Uses `m.*()` calls (pillar 3).
- Calls `client.posts.list({ locale })` for dynamic content (pillar 2).
- Doesn't touch pillar 1 unless contributing translations upstream.

**CI:**

- Runs `voila i18n check` to gate merges on translation coverage (pillar 3).

Three audiences, three workflows. No conflation.

---

## Why this design

- **Pillar separation** keeps the data shape honest. Dynamic content per record ≠ flat UI catalog ≠ admin's own strings. Same `Locale` type, different storage, different UX.
- **DB as source of truth** for pillars 2 and 3 means editors can always reach for the admin. Files for pillar 3 are a synced artifact, not a parallel store.
- **Standard Inlang format on disk** means we don't lock you into TanStack — the messages travel to Astro, Next, anything.
- **Bidirectional sync, non-destructive** means devs and editors can each start work without coordinating. The merge converges.
- **Static `Locale` union** means typos die at compile time, not in production logs.
- **`effect/Schema` localized fields** encode the locale dimension in annotations, so `@voila/content-sql` can derive the right storage shape per dialect without bespoke migration logic.

---

Continue → [Roadmap — Effect Rebuild](../pivot/roadmap-effect.md)
