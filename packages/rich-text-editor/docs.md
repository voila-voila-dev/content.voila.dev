# Rich-text editor — design & roadmap

The Voila rich-text editor is a reusable, framework-agnostic editor built on
[Plate](https://platejs.org) (which sits on [Slate](https://slatejs.org)). It is
**not** specific to `@voila/content` — any React app can depend on it. The
content framework merely composes it into the `richText` field.

The north star is a Notion-grade editing experience. The reference bar is
[Potion](https://pro.platejs.org/docs/templates/potion), the official Plate Pro
template (a Notion clone): slash menus, drag handles, tables, media, math,
mentions, AI, comments, suggestions, real-time collaboration. We get there
incrementally, but every primitive we ship is designed so the next layer drops
in without a rewrite.

This doc is the editor's own roadmap, in the spirit of the product
[12 — Roadmap](../../products/content.voila.dev/docs/requirements/12-roadmap.md).

---

## One package, two seams

Behavior and presentation live in one package but stay deliberately separable,
so each can be swapped:

| Entry                             | Role          | Ships                                                                 |
| --------------------------------- | ------------- | --------------------------------------------------------------------- |
| `@voila/rich-text-editor`         | **Behavior**  | Plugin sets, the headless `<RichTextEditor>`, `mention()`, serialization (`toHtml` / `toJson` / `toPlainText`), base surface styles. |
| `@voila/rich-text-editor/nodes`   | **Presentation** | The default `nodeComponents` map + each node's React component, exported individually so you can cherry-pick, restyle, or override. |

The editor renders nodes with whatever `components` map it's handed — so you can
keep our plugins and bring your own components, or vice-versa. `@voila/content`
wires both and exposes `plugins` / `components` pass-throughs on the `richText`
field.

```
@voila/rich-text-editor         ──plugins, <RichTextEditor>──┐
                                                              ├──►  @voila/content  ──►  richText field
@voila/rich-text-editor/nodes    ──nodeComponents────────────┘                          (extensible by the user)
```

## Principles

1. **Headless core, swappable skin.** Behavior never hard-codes a component.
   Presentation never owns editing logic. The `components` prop is the seam.
2. **JSON is the source of truth.** The stored value is a Slate node tree.
   HTML/markdown/plaintext are derived, never primary.
3. **Every node renders without an editor.** Interactive and static (SSR)
   variants stay in lockstep so the public site renders read-only content with
   no `contenteditable` and no client JS.
4. **Extend, don't fork.** New marks/blocks are added as plugins + components,
   shipped as separate `@platejs/*`-style entry points where it helps tree-shaking.
5. **Type-safe end to end.** `Value`, `TElement`, and friends are re-exported so
   consumers never reach into `platejs` directly.

---

## Status today (shipped)

- [X] Behavior / presentation split (`@voila/rich-text-editor` + `/nodes` subpath)
- [X] Headless `<RichTextEditor value onChange plugins components readOnly />`
- [X] `basicPlugins`: bold, italic, underline, strikethrough, inline code; H1–H3; blockquote; links; bulleted/numbered lists
- [X] `nodeComponents` default map + individual node components (overridable)
- [X] `mention({ source })` factory (`@voila/rich-text-editor/mention`)
- [X] Serialization: `toHtml`, `toJson`, `toPlainText` (self-contained, no DOM)
- [X] Base + node styles (`styles.css`)
- [X] Unit tests for serialization and the component registry

---

## E1 — Core editing UX

- [ ] Fixed toolbar (block type, marks, alignment, lists, link, more menu)
- [ ] Floating/selection toolbar (marks + turn-into on selection)
- [ ] Slash command menu (`/heading`, `/list`, `/quote`, …) via `@platejs/slash-command`
- [ ] Autoformat: markdown shortcuts (`# `, `- `, `> `, `` ` ``, `**`, `1.`) via `@platejs/autoformat`
- [ ] Block placeholder ("Type / for commands") on empty blocks
- [ ] Remaining marks: highlight, superscript, subscript, kbd (`@platejs/basic-styles`)
- [ ] Font color / background color (`@platejs/basic-styles`)
- [ ] Horizontal rule, soft break, exit break
- [ ] Indent + alignment (`@platejs/indent`)
- [ ] Link toolbar (edit/open/unlink) + paste-to-link

**Exit criterion**: a writer can produce a formatted document end-to-end using
only the keyboard and the slash menu — no field config beyond `basicPlugins`.

## E2 — Rich blocks

- [ ] Code block with syntax highlight (Shiki, server-renderable) — `@platejs/code-block`
- [ ] Tables: insert, resize, merge, header rows — `@platejs/table`
- [ ] Media: image, video, audio, file, embed — `@platejs/media` + `@platejs/caption` + `@platejs/resizable`
- [ ] Media upload pipeline (hooks into the `media` field / storage; toast + progress)
- [ ] Callouts — `@platejs/callout`
- [ ] Toggles (collapsible) — `@platejs/toggle`
- [ ] Columns / layout — `@platejs/layout`
- [ ] Date node — `@platejs/date`
- [ ] Emoji picker (`:smile:`) — `@platejs/emoji`
- [ ] Table of contents — `@platejs/toc`
- [ ] Equations / inline math (KaTeX) — `@platejs/math`

**Exit criterion**: every Potion block type has a Voila equivalent with an
interactive and a static component.

## E3 — Serialization & interop

- [ ] Markdown roundtrip: `toMarkdown` / `fromMarkdown` — `@platejs/markdown`
- [ ] HTML deserialize on paste (Word/Google Docs cleanup) — `@platejs/docx`
- [ ] DOCX import/export — `@platejs/docx-io`
- [ ] Static SSR render set in `@voila/rich-text-editor/nodes` (mirror of every node)
- [ ] HTML sanitization policy (allowlist) for stored + rendered output
- [ ] Plaintext/search-index projection (extends current `toPlainText`)

**Exit criterion**: a document survives `json → markdown → json` and
`json → html (static) → render` with no loss for all E1/E2 nodes.

## E4 — Intelligence (AI)

- [ ] AI menu: ask, edit selection, continue writing — `@platejs/ai`
- [ ] Copilot ghost-text (inline completion) — `@platejs/ai` + provider hook
- [ ] AI slash commands (`/ai …`) and streaming responses
- [ ] Provider-agnostic adapter (defaults to the latest Claude models)

**Exit criterion**: selection → "improve writing" streams a suggestion that can
be accepted/rejected, with the provider injected by the host app.

## E5 — Collaboration & review

- [ ] Comments / discussions on ranges — `@platejs/comment`
- [ ] Suggestions / track changes + diff view — `@platejs/suggestion` + `@platejs/diff`
- [ ] Version history (snapshot + restore)
- [ ] Real-time collaboration via Yjs — `@platejs/yjs` + remote cursor overlay
- [ ] Presence (who's editing) wired to the host's auth/session

**Exit criterion**: two browsers edit the same document concurrently with live
cursors; a reviewer can comment and accept/reject suggestions.

## E6 — Block tooling

- [ ] Drag handle + block reordering — `@platejs/dnd`
- [ ] Block menu (insert/turn-into/delete/duplicate) — `@platejs/block-menu` style
- [ ] Block selection (multi-block) — `@platejs/selection`
- [ ] Block context menu (right-click)
- [ ] Cursor overlay + scroll-into-view affordances

**Exit criterion**: blocks can be reordered by drag and transformed via a menu,
matching Potion's drag-handle UX.

---

## Cross-cutting tracks

- [ ] **Theming**: components consume `@voila/ui` tokens; dark mode out of the box
- [ ] **Accessibility**: keyboard map, ARIA roles on toolbars/menus, focus management
- [ ] **Mobile**: touch selection, virtual-keyboard-aware toolbars
- [ ] **i18n**: editor chrome strings translatable (Paraglide/Inlang, like the admin)
- [ ] **Performance**: large-document virtualization, memoized node components
- [ ] **Test utilities**: `@platejs/test-utils`-based fixtures + a playground story per node

## Testing bar

- [ ] **Unit**: serialization roundtrips (`json ⇄ html`, `json ⇄ markdown`) per node
- [ ] **Component**: every node renders in both interactive and static modes
- [ ] **Integration**: slash menu, autoformat, paste-cleanup, media upload
- [ ] **E2E**: type a full document, format via toolbar + shortcuts, publish, render read-only on a public page
- [ ] **A11y**: axe pass on the editor surface and all toolbars/menus
- [ ] **Perf**: typing latency budget on a 10k-node document

## Explicit non-goals

- A standalone "studio" app — this is a library, not a product.
- A WYSIWYG page builder — blocks compose content, not layout/marketing pages
  (that's out of scope for `@voila/content` too).
- Locking to one AI or storage provider — both are injected by the host.
- Forking Plate — we track upstream `@platejs/*` and contribute back where we can.

---

## Parity snapshot vs Potion

| Capability                         | Potion | Voila |
| ---------------------------------- | :----: | :---: |
| Basic marks + H1–H3 + blockquote   |   ✅   |  ✅   |
| Lists (bulleted/numbered)          |   ✅   |  ✅   |
| Links + mentions                   |   ✅   |  ✅ (mention factory) |
| HTML / JSON / plaintext export     |   ✅   |  ✅   |
| Slash menu + autoformat            |   ✅   |  E1   |
| Toolbars (fixed + floating)        |   ✅   |  E1   |
| Code blocks, tables, media, math   |   ✅   |  E2   |
| Markdown / DOCX interop            |   ✅   |  E3   |
| AI menu + copilot                  |   ✅   |  E4   |
| Comments, suggestions, versions    |   ✅   |  E5   |
| Real-time collaboration (Yjs)      |   ✅   |  E5   |
| Drag handle + block menu           |   ✅   |  E6   |
