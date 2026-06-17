# Plan — vending the Plate rich-text editor as the `markdown`/`richText` edit widget (2026-06-12)

Closes the last open line of audit item #15
(`docs/2026-06-12-ui-ux-devx-audit.md`):

> Longer term: registry item vending the Plate-based rich-text editor as the
> `markdown`/`richtext` edit widget.

This is the first registry item of type `field` (the type exists in
`RegistryItemType` but has never been used), the first item whose npm
dependency is a *heavy* package (`@voila/rich-text-editor` → 5 `@platejs/*`
packages), and the first time the engine's `richText` field — shipped in
Phase 0 and inert since — gets an actual editing surface. It is also the
moment the `@voila/rich-text-editor` ⇄ `@voila/content` seam promised in the
editor's own roadmap ("`@voila/content` wires both and exposes
`plugins`/`components` pass-throughs on the `richText` field") gets built.

---

## 1. Where things stand today

### `@voila/rich-text-editor` (workspace root `packages/`, v0.1.0, unpublished)

- Headless `<RichTextEditor value onChange plugins components placeholder
  readOnly className />` over Plate v53 (`packages/rich-text-editor/src/editor.tsx`).
- `basicPlugins`: bold, italic, underline, strikethrough, inline code, H1–H3,
  blockquote, links, bulleted/numbered lists (classic list model: `ul`/`ol` >
  `li` > `lic`).
- Subpaths: `/nodes` (default `nodeComponents` + each component individually),
  `/mention`, `/serialize` (`toHtml`/`toPlainText`/`toJson`), `/styles.css`.
- Own roadmap in `packages/rich-text-editor/docs.md` — E1 (toolbars, slash
  menu, autoformat) and E3 (markdown roundtrip via `@platejs/markdown`) are the
  epics this plan depends on pieces of.

### `@voila/content` — two field kinds, two value models

| Kind | Stored value | meta carries | Edit widget today | Display today |
|---|---|---|---|---|
| `markdown` | `string` (flavor `commonmark`/`gfm`/`mdx`) | `flavor` | `MonospaceTextareaInput` (audit #15 short-term fix) | `MultilineTextDisplay` |
| `richText` | `RichTextValue` — JSON node tree | `elements`, `marks`, `plugins`, `components`, `toolbar` (the last three typed `unknown`, "narrowed at the Head's editor call site" — i.e. *here*) | **none** → `UnsupportedInput` | **none** → `JsonDisplay` |

The `richText` field (`content/src/config/schema/fields/rich-text/`) builds a
real recursive validator from its `elements`/`marks` defs: every write is
validated against exactly the allowed node set, so whatever the editor emits
**must** decode against that schema or the form 422s.

### `@voila/content-ui` — the widget seam

- `EditWidgetProps = { value, onChange, field, id, labelId?, error?, disabled? }`;
  resolution is `meta.widget ?? meta.kind` → registry map → `UnsupportedInput`
  (`content-ui/src/registry/edit.ts`). Both field constructors already set
  `widget` (`"markdown"` / `"richText"`), so a registry entry under either key
  is picked up with zero engine changes.
- `CollectionForm` accepts a `registry?: EditRegistry` prop and
  `mergeEditRegistry(overrides)` layers custom widgets over the defaults — the
  designed escape hatch this item plugs into.
- Client-side `validateFields` re-runs each field's Standard Schema before
  submit — same contract as the REST write path.

### `@voila/content-registry` + CLI — the vending machine

- shadcn-style: items = real source files under `src/items/` + npm
  `dependencies` + `registryDependencies`; `resolve()` (cycles/conflicts),
  `vendFiles` (skip-unless-`--overwrite`), `voila list/add/diff`; `add`
  validates the host and retargets `app/` → the host's actual src dir.
- `src/items/` is excluded from the package's tsc — vended sources are
  currently *not typechecked* (a gap this plan has to close, because the
  rich-text widget will be by far the most complex vended file).
- Audit #19 (template should consume registry items, not duplicate them) is
  still open — this plan is written so it composes with that work rather than
  blocking on it.

---

## 2. The gaps (what actually stands between here and "it works")

### G1 — Format impedance: the engine schema and Plate disagree on node shape

Confirmed against source, this is the core technical problem:

| Concern | Engine (`rich-text/_core.ts` + `elements/`) | Plate v53 (`basicPlugins` + `serialize.ts`) |
|---|---|---|
| Element type names | `"paragraph"`, `"heading-1"`…`"heading-6"`, `"blockquote"`, `"bullet-list"`, `"ordered-list"`, `"list-item"`, `"code-block"`, `"link"`, `"horizontal-rule"`, `"table-*"`, media… | `"p"`, `"h1"`…`"h3"`, `"blockquote"`, `"ul"`, `"ol"`, `"li"`, `"lic"`, `"a"` |
| Element identity | `id: string` **required** on every element | no ids by default (Plate has an id plugin, but ids aren't in `basicPlugins`) |
| List structure | `bullet-list` > `list-item` > inline children | classic list: `ul` > `li` > `lic` (list-item-content wrapper) |
| Link attrs | `link` element | `a` with `url` |
| Marks | `bold/italic/underline/strikethrough/code/highlight/sub/superscript/kbd/color/backgroundColor/fontFamily/fontSize` | basic five match by name; the rest unshipped (E1/E2) |

So the **stored wire format is the engine schema** (principle: JSON is the
source of truth, and the validator enforces it) and the editor needs a
bidirectional, lossless adapter:

```
wire (RichTextValue, validated)  ──fromWire──►  Plate Value (editor state)
wire (RichTextValue, validated)  ◄──toWire───  Plate Value (on change)
```

Alternatives considered and rejected:
- *Rename the engine literals to Plate's short names*: breaks the schema's
  readability promise (stored JSON is consumer-facing API), couples the wire
  format to one editor library forever, and `lic` is a Plate-ism nobody should
  persist.
- *Reconfigure Plate plugins to use the long names*: fights every upstream
  `@platejs/*` package (autoformat, slash menu, components are keyed to the
  short types) — permanent maintenance tax, contradicts "track upstream,
  don't fork".

**Decision: adapter, living in `@voila/rich-text-editor` (new `/content`
subpath), not in the vended file** — it needs real tests (roundtrip per node
type) and one canonical implementation; the vended file stays thin glue the
user can safely own. Type-only imports from `@voila/content` keep the editor
package framework-agnostic (optional peer / dev-dep for types).

### G2 — `id` strategy

The engine requires `id` on every element; the editor must (a) preserve ids
through editing, (b) mint ids for nodes the writer creates. Plan: enable
Plate's node-id plugin in the plugin set the widget uses (ids ride along in
editor state), and make `toWire` backfill any missing id (`crypto.randomUUID()`)
as a safety net so the value always validates. Splits/merges getting fresh ids
is acceptable — nothing downstream depends on id stability yet (no comments/
collab until E5); note it as a known semantic.

### G3 — Capability gap: engine defaults > editor capability

`richText()` with no options allows **28 element kinds and 13 marks** (tables,
media, callout, embed, mention, placeholders…); `basicPlugins` covers ~10
element kinds and 5 marks. Two failure modes to design against:

1. **Destructive normalization**: Slate strips/unwraps unknown nodes. A
   document containing a `table` (authored via API or a future editor) opened
   in the basic widget must not silently lose the table on save.
2. **Schema mismatch on save**: if the field was *restricted*
   (`richText({ elements: [paragraph, link] })`), the editor must not offer H1.

Plan:
- The widget derives its plugin set from `meta.elements`/`meta.marks`
  **intersected with** what the editor supports, via a capability map the
  `/content` subpath exports (`supportedElements: Record<wireType, Plugin>`).
  Restricted fields get a restricted editor for free; this is the designed
  narrowing point for the `plugins`/`components`/`toolbar` passthroughs too.
- **Unknown-node preservation**: `fromWire` wraps unsupported elements in an
  opaque void "unsupported block" node (rendered read-only with a label:
  "Table — not editable here"); `toWire` unwraps it byte-identical. This is
  the only honest behaviour until E2 closes the gap, and it keeps the
  capability map allowed to grow without data risk.

### G4 — `markdown` is a different problem than `richText`

`markdown` stores a `string`; rich editing of it requires markdown ⇄ Plate
roundtrip — exactly editor-roadmap **E3** (`@platejs/markdown`), which is
unshipped and inherently lossy at the edges (MDX, exotic GFM). Decisions:

- **Ship `richText` first; `markdown` rich mode is a follow-up phase** gated
  on E3. The monospace textarea (audit #15 short-term) remains the honest
  default for `markdown` meanwhile.
- When it ships: editor state is the Plate value; deserialize **once** on
  mount, serialize to markdown on change (debounced) — never re-parse on every
  keystroke or the cursor jumps. Respect `meta.flavor`; for `mdx`, refuse rich
  mode (MDX cannot roundtrip) and keep the textarea.
- Same vended file handles both kinds (registered under both keys), branching
  on `field.meta.kind` — one item, one mental model.

### G5 — Wiring: how the widget reaches `CollectionForm`

`voila add` copies files; it cannot edit the user's existing route files to
thread `registry={...}` through. Options:

1. **Manual wiring**: item description + `add` output tell the user to pass
   `registry={mergeEditRegistry({ richText: RichTextInput, markdown: RichTextInput })}`
   in their form pages. Zero magic, but the audit's whole thrust is that
   manual wiring is where scaffolds die.
2. **Widgets-seam file** *(recommended)*: the template's (and registry's)
   form/detail pages import their registries from one vended indirection file,
   `app/lib/widgets.ts`, which defaults to the built-in registries. The
   rich-text item then **owns and overwrites that one file** (declared with
   `target: "app/lib/widgets.ts"`); every page picks the widget up with no
   edits. Requires the per-collection page items from audit #5/#19 to adopt
   the import — a 3-line change to each page, done as part of this plan.
3. Vend updated copies of the form pages: conflicts with user-edited pages —
   rejected.

Option 2 also gives every *future* widget item (relation picker, media
browser…) the same drop-in seam, and it is the first concrete step of audit
#19's "template consumes registry items" direction.

### G6 — Styling

- The editor's chrome/nodes are styled by `@voila/rich-text-editor/styles.css`
  (the package sets `sideEffects` for CSS). The vended widget imports it
  module-side — Vite handles it; no edit to the app's `styles.css` needed.
- Tailwind classes inside the *vended* files are covered by the app's own
  `@source` scan (they live under `app/`). If the widget leans on classes that
  only appear inside the npm package, that package needs an `@source` line
  like `@voila/content-ui/tailwind` grew in audit #14 — check during
  implementation; prefer keeping npm-package styling in `styles.css` tokens
  (consume `@voila/ui` CSS variables for dark mode).

### G7 — Publishing & version pins

`voila add` installs from npm. Hard prerequisites, all lessons from audit #1:

- Publish `@voila/rich-text-editor@0.1.0` (it already has
  `publishConfig.access: public`; today it ships raw `src/` exports — needs
  the same build/exports treatment as the other published packages).
- Add a `RICH_TEXT = "^0.1.0"` pin const in `content-registry/src/registry.ts`
  and extend `create-voila/src/template-versions.test.ts`'s range-vs-workspace
  check to cover **registry item dependencies**, not just template pins (it
  must also assert the package isn't `private`).
- Plate stays a transitive dep of `@voila/rich-text-editor` — the vended files
  import **only** `@voila/rich-text-editor[/…]`, `@voila/content`,
  `@voila/content-ui`, `@voila/ui` (editor principle 5: consumers never reach
  into `platejs`). This keeps the item's `dependencies` list to one new entry
  and lets the editor package manage the v53 pin in one place.

### G8 — Vended sources are not typechecked or tested today

Acceptable for a 30-line layout file; not for this widget. Plan: give
`content-registry` an `items-check` tsconfig (or a bun test that typechecks
`src/items/**` against the item dependencies as devDeps) wired into the root
gate, plus component tests for the widget itself (see §5). The widget's hard
logic (wire adapter, capability map) deliberately lives in the *published*
package where the normal 100%-coverage bar applies — the vended file should be
small enough that a render + change + submit test covers it.

---

## 3. Deliverables, file by file

### A. `@voila/rich-text-editor` (published package — the heavy lifting)

```
src/content/wire.ts        fromWire(value, opts) / toWire(value)
                           — type-name + list-shape + link mapping, id backfill,
                             unknown-node wrap/unwrap (G1, G2, G3)
src/content/capabilities.ts supportedElements / supportedMarks: wire name →
                           { plugin, components } — the meta.elements →
                           plugin-set derivation table (G3)
src/content/index.ts       subpath export `@voila/rich-text-editor/content`;
                           type-only imports from @voila/content
src/nodes/unsupported.tsx  read-only void block for preserved unknown nodes
package.json               + "./content" export; @voila/content as optional
                           peer (types only); publish prep
```

E1 items this pulls forward (needed for a credible CMS editing surface, per
the editor roadmap): **fixed toolbar** (driven by the field's `toolbar` meta
when present) and **autoformat** markdown shortcuts. Slash menu stays E1-later;
the widget works without it.

### B. `@voila/content-registry` — the item + seam

```
src/items/app/lib/widgets.ts                      (new item: `widgets` — the seam, G5;
                                                   default export = built-in registries)
src/items/app/components/widgets/rich-text.tsx     RichTextInput (EditWidget):
                                                   kind branch (richText | markdown),
                                                   fromWire/toWire, plugin derivation,
                                                   error/aria wiring per EditWidgetProps,
                                                   css import
src/items/app/components/widgets/rich-text-display.tsx
                                                   RichTextDisplay (DisplayWidget):
                                                   static render via toHtml/nodes for
                                                   DetailView; toPlainText + truncate
                                                   for table cells
src/registry.ts                                    + `widgets` item (type "lib")
                                                   + `rich-text-editor` item (type "field",
                                                     registryDependencies: ["widgets"],
                                                     dependencies: { "@voila/rich-text-editor": RICH_TEXT },
                                                     files: the two widget files + an
                                                     overwriting widgets.ts target)
```

Registry entry sketch:

```ts
{
  name: "rich-text-editor",
  type: "field",
  title: "Rich-text editor",
  description:
    "Plate-based editor for richText and markdown fields. Replaces the plain " +
    "textarea; wires itself in via app/lib/widgets.ts.",
  dependencies: { "@voila/rich-text-editor": RICH_TEXT },
  registryDependencies: ["widgets"],
  files: [
    { path: "app/components/widgets/rich-text.tsx" },
    { path: "app/components/widgets/rich-text-display.tsx" },
    { path: "app/lib/widgets.rich-text.ts", target: "app/lib/widgets.ts" },
  ],
}
```

(The `target` override vends the rich-text-flavored seam over the default one;
`vendFiles` skip-unless-`--overwrite` semantics already produce the right
prompt when the user has edited it. `voila diff` shows the change first.)

### C. `@voila/content-ui` — small, non-breaking accompaniments

- `defaultDisplayRegistry`: add a dependency-free `richText` entry that flattens
  to plain text (a 10-line `nodeText` walk — *not* a platejs import), replacing
  today's `JsonDisplay` garbage rendering. Honest OOB even before vending.
- `UnsupportedInput` for `richText` stays the un-vended edit default — but its
  copy should say *"Rich text — run `voila add rich-text-editor`"* so the gap
  advertises its own fix.
- Export a `Doc`-safe `EditRegistry`/`DisplayRegistry` pair from one place if
  the widgets-seam file needs it (likely already exported).

### D. Template + demo adoption (composes with audit #5/#19 work)

- Template form/detail pages import registries from `app/lib/widgets.ts`
  (vend the default `widgets` item into the scaffold — first concrete step of
  #19's "scaffold = vendFiles of a default item set").
- `examples/demo`: add a `richText` field to `posts`, run
  `voila add rich-text-editor`, and keep it as the living integration repro
  (same role it played for the audit).

---

## 4. Phasing

**Phase 1 — Foundation (engine + editor, no registry yet)**
- [x] `@voila/rich-text-editor/content`: wire adapter (`fromWire`/`toWire`) +
      capability map (`supportedElements`/`supportedMarks`/`derivePlugins`) +
      unsupported-node preservation (`UnsupportedElement` void block); roundtrip
      tests per element/mark (`wire → Plate → wire` value-equal, including
      deeply-nested unknown nodes and id backfill). `wire.ts` is framework-free
      (type-only `@voila/content` import); `capabilities.ts` does the
      meta.elements → plugin-set derivation. Both at 100% coverage.
- [x] Node-id plugin in the widget plugin set (G2) — `NodeIdPlugin` is always in
      `derivePlugins`'s output; `toWire` backfills any still-missing id as the
      safety net.
- [x] Fixed toolbar + autoformat (the E1 subset). **Autoformat**: feature-owned
      markdown `inputRules` (`# `, `## `, `### `, `> `, `- `/`* `, `1. `, `**bold**`,
      `*italic*`, `__underline__`, `` `code` ``, `~~strike~~`) attached per-plugin in
      `derivePlugins` (v53 model — `@platejs/autoformat` is deprecated/inert), gated by
      capability and opt-out via `derivePlugins(…, { autoformat: false })`. **Fixed
      toolbar**: `<RichTextToolbar model={deriveToolbar(elements, marks)}>` (+
      `deriveMarkdownToolbar(flavor)`) — block-type / mark / list controls, capability-
      gated, `role="toolbar"` + `aria-pressed` reflecting the selection, rendered via a
      new `RichTextEditor` `toolbar` prop and wired into the vended widget for both
      `richText` and `markdown`. Floating toolbar / slash menu / link toolbar / alignment
      remain later E1 lines.
- [x] Publish prep for `@voila/rich-text-editor` (G7). The package already
      matches the raw-`./src` publish shape of every other workspace package —
      this monorepo has **no build step** (`@voila/content`/`content-ui` ship
      `./src/*.ts` exports directly), so there's nothing to build; `./content`
      export, `publishConfig.access: public`, not-`private`, and the
      `RICH_TEXT = "^0.1.0"` pin const are all in place. `template-versions.test.ts`
      now also walks **registry item dependencies** (not just template pins),
      asserting each workspace dep satisfies its pinned range and isn't private —
      so `@voila/rich-text-editor` (the `voila add rich-text-editor` install) is
      gated against the same stale/private→404 failure as the template. The
      remaining step is the actual `npm publish` (outward action), which is what
      unblocks the Phase 2 E2E exit below.
- Exit: ✅ `test/content/edit-session.test.ts` composes `richText()`'s validator
  with the adapter through a *real* Plate editor — a doc with an unsupported
  `table` survives create + normalize byte-identical, and a mid-session insert
  still emits a valid, id-complete document.

**Phase 2 — The registry item** ✅ (done 2026-06-14, except the publish-gated E2E)
- [x] `widgets` seam item (`lib`) + template pages consuming it: pages import
      `editWidgets`/`displayWidgets` from `app/lib/widgets.ts`, vended at scaffold
      time via `DEFAULT_ITEMS += "widgets"` (so it's registry-owned, not a
      template duplicate — the single-source test stays green). No `examples/demo`
      exists today; the demo adoption is left for when that repro is recreated.
- [x] `rich-text-editor` item (`field`) registered with the two widget files +
      the `widgets.rich-text.ts → app/lib/widgets.ts` override; integrity suite
      green. The resolver gained a **dependency-gated file override**: an item may
      overwrite a file it inherits from a `registryDependency` (collisions between
      unrelated items still throw) — this is what lets `rich-text-editor` depend
      on `widgets` *and* overwrite its seam file.
- [x] Items typecheck gate (G8): `content-registry/tsconfig.items.json` typechecks
      the framework-agnostic widget + seam sources against the item deps (added as
      this package's devDeps); wired into the root `check` as `bun run check:items`.
- [x] Component tests (100% cov on the vended files): render with a `richText`
      field, mount-normalize emits a schema-valid, id-complete wire document;
      restricted field derives a restricted editor; error/aria contract
      (`aria-invalid`, `${id}-error`, named via `labelId`) matches the other
      widgets. (Toolbar reflection is deferred — toolbars are the E1 subset, not
      yet built.) Editor gained `id`/aria forwarding onto `PlateContent` for this.
      content-ui also got `RichTextValueDisplay` (dependency-free plain-text
      flatten) as the honest OOB `richText` display, and `UnsupportedInput` now
      advertises `voila add rich-text-editor`.
- Exit (partial): fresh scaffold → `voila add rich-text-editor` proven end-to-end
  via the CLI (seam overwrite + widget files vended). The full create/edit → REST
  roundtrip → DetailView CI gate is **deferred with G7** (publishing
  `@voila/rich-text-editor` to npm) — `voila add`'s install step 404s until then.

**Phase 3 — `markdown` rich mode** ✅ (done 2026-06-14)
- [x] `toMarkdown`/`fromMarkdown` in `@voila/rich-text-editor/serialize`
      (`@platejs/markdown` + `remark-gfm`), flavor-aware; round-trip tests for the
      E1 node set. The serializer keeps a single **headless** slate editor built
      from the `Base*` (non-React) E1 plugins — `@platejs/markdown` round-trips
      the classic `ul > li > lic` list shape, but only when the editor it's given
      has the classic-list plugins registered (it resolves node types through
      plugin keys). GFM adds `remarkGfm` (`~~strikethrough~~`); `underline` (and
      `strikethrough` under CommonMark) have no markdown spelling and serialize as
      plain text via `plainMarks` rather than throwing. Both files at 100% lines.
- [x] Widget `markdown` branch: `RichTextInput` branches on `field.meta.kind`.
      Markdown deserializes once on mount (`fromMarkdown`) and serializes back on
      change (`toMarkdown`) — **immediate, not debounced**: the cursor-jump risk
      is in *deserialize* (done once on mount), and serializing eagerly keeps the
      form value exact for submit/validation (markdown serialization is cheap).
      `mdx` → raw textarea only (no toggle, can't round-trip); `commonmark`/`gfm`
      start rich with a "Edit Markdown" ⇄ "Rich editor" toggle (toggling remounts
      the editor so a raw-mode edit is re-read). The markdown editor's plugin set
      is fixed by `deriveMarkdownPlugins(flavor)` to the markdown-representable
      kinds (underline never offered). Seam (`widgets.rich-text.ts`) now registers
      the widget under both `richText` and `markdown` keys; one item, one file.
- Exit: ✅ `markdown` field edits richly, stores clean GFM, and the textarea
  remains one toggle away. (Markdown *display* stays the default multiline-text
  render — no detail-view formatting requirement in this phase.)

**Phase 4 — Polish & growth (tracked, not blocking)** — 5/5 done (2026-06-17).
First `examples/demo` wiring of the editor: a `richText`
`content` field + a localized `richText` `summary` field, the rich-text seam
vended to `app/lib/widgets.ts` (pages now pass `registry`/`locales`), proven
end-to-end in the browser (create → REST roundtrip → DetailView).
- [x] Localized fields: `LocalizedFieldEditor` renders one editor per locale —
      verified two independent editors (en-US/fr-FR) coexist. `RichTextEditor`
      now threads its DOM `id` into `usePlateEditor({ id })` so multiple editors
      on one page never share a Plate store (the localized fix).
- [x] Slash menu + placeholder. `derivePlugins(…, { slash: true })` wires
      `@platejs/slash-command`'s `SlashPlugin`/`SlashInputPlugin`; the menu's
      commands are `deriveSlashItems(deriveToolbar(...))` (the field's blocks +
      lists, capability-gated → never offers a block the field can't persist),
      applied with the same transforms as the toolbar. Renders through a new
      **shared `InlineCombobox`** (`combobox.tsx`, Ariakit + `@platejs/combobox`,
      plate-ui pattern ported to plain `voila-rich-text-combobox*` classes — no
      Tailwind/cva dep). Skipped when the field has no blocks. Placeholder
      surfaced via the widget ("…press / for commands…").
- [x] Media elements wired to the `_media` upload pipeline (editor E2 ×
      Phase 5 media). New feature-owned `src/media.tsx` (mirrors `mention.tsx`):
      `image` + `image-placeholder` block-void plugins, `mediaPlugins({ upload })`,
      the `insertImageFiles` transform (placeholder while the bytes upload, then
      the image — or the placeholder is removed on failure; matched back by a
      transient `_uploadId` so it survives concurrent edits), drop/paste handlers,
      and a `RichTextImageButton` toolbar control. The editor stays data-agnostic —
      the host supplies `upload` (typically `mediaClient.upload`), exactly like
      mention's `items`. `derivePlugins(…, { media })` gates it: images render
      read-only whenever the field allows the `image` kind, and the insert UI
      (placeholder + drop/paste + button) only when `upload` is supplied. `image`/
      `image-placeholder` added to the wire adapter's `WIRE_TO_PLATE` so they
      round-trip + validate (the engine validator strips the placeholder's
      transient props); `serialize` renders an `<figure>` for the read-only
      display. `RichTextToolbar` gained an `extra` slot for the image button.
      Demo wired end-to-end: `coverImage: media()` field (provisions `voila_media`),
      `makeFsStorage` + `makeMediaStore` media context on the server, a
      `mediaClient` over the CSRF-aware fetch, and the demo widget passing
      `media` + the button. `video`/`file`/`embed` follow the same pattern and
      are additive (preserved opaquely until then).
- [x] Mention element ⇄ `mention()` factory with a documents/users source.
      `mentionPlugins({ source, items })` wires `MentionPlugin` +
      `MentionInputPlugin` (combobox over the same `InlineCombobox`), inserting a
      `mention` node shaped to the engine's `mention()` schema
      (`source`/`value`/`label`); `mention` added to the wire adapter's
      `WIRE_TO_PLATE` so it round-trips and validates (roundtrip + schema-loop
      tests). `derivePlugins(…, { mention })` enables it only when the field
      allows the `mention` kind *and* a source is supplied. `toHtml`/`toPlainText`
      now render a mention inline (`@label`) for the read-only display. The demo
      widget wires a static people source as the showcase.
- [x] Dark mode + tokens audit of `styles.css` against `@voila/ui` variables.
      The toolbar styles referenced HSL-*channel* tokens (`--border: 240 6% 90%`)
      as raw color values — invalid CSS whenever the host's tokens were present.
      Every token reference is now `hsl(var(--token, <neutral channels>))` (valid
      standalone *and* themed), links get a dedicated `--rt-link`/`--rt-link-dark`
      pair, code/mention/unsupported use `--muted`/`--accent`, and the new
      combobox chrome is token-themed. Verified in the browser in dark mode
      (popover, toolbar, mention pill, content all correct).

---

## 5. Testing bar

| Layer | Test |
|---|---|
| Adapter | Per-node roundtrip `wire → fromWire → toWire → wire` (byte-equal); unknown-node preservation; id backfill; restricted `elements`/`marks` derivation |
| Schema loop | Adapter output validates against `richText()`'s own Standard Schema for default *and* restricted fields |
| Widget | Render/type/emit; toolbar reflects field restriction; error + label aria contract; works inside `CollectionForm` submit → `validateFields` clean |
| Registry | Integrity suite (files exist, deps resolve) — already enforced; new items-typecheck gate |
| E2E | Scaffold → `add rich-text-editor` → create → edit → REST roundtrip → DetailView render (extends the audit's proposed scaffold CI gate) |
| Coverage | Adapter + capability map live in the published package under the normal 100% gate; vended files covered by widget component tests |

## 6. Risks & open questions

- **Plate v53 churn**: Plate majors move fast; the `^53` ranges live in one
  package (good), but the adapter's type-name map must be covered by tests
  that fail loudly if a plugin's node type changes.
- **Normalization vs preservation**: the unsupported-node wrap (G3) must be
  proven against Slate's normalizer with nested unknowns (a `table` containing
  `mention`s) — this is the highest-risk piece of Phase 1 and should be built
  test-first.
- **Seam-file overwrite UX** (G5): `voila add rich-text-editor` overwriting a
  user-customized `widgets.ts` is mitigated by skip+`--overwrite` and
  `voila diff`, but the message should explain *what* to merge manually. Open:
  should `add` print the diff inline when it skips?
- **`meta.plugins`/`components` passthrough**: typed `unknown` in the engine by
  design; the vended widget is the narrowing site. Open: narrow to the editor's
  types via the `/content` subpath (`RichTextEditorOptions`) or leave the
  passthrough for power users only in v1? Lean: leave for v1; capability map
  covers the common cases.
- **One item or two for markdown**: this plan says one item, branch on kind.
  If Phase 3 slips far behind Phase 2, revisit shipping `markdown` support as
  a follow-up overwrite of the same files rather than a second item.
- **Id stability semantics** (G2): fine today, becomes load-bearing at editor
  E5 (comments anchor to ids). Document the "fresh id on split" behaviour now.

## 7. Explicit non-goals

- No rich-text *display* on the public site beyond what `/serialize` +
  `/nodes` already offer — the static SSR node set is editor-roadmap E3.
- No slash menu / drag handles / tables / media editing in the first ship —
  capability map + preservation make these additive later.
- No engine schema changes: the wire format (long type names, required ids)
  is the contract; the editor adapts to it, never the reverse.
- No editing of `mdx`-flavored markdown in rich mode, ever, until a real MDX
  story exists.
