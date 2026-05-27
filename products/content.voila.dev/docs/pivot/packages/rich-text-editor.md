# @voila/rich-text-editor

> Plate/Slate editor behavior (root import) and default node components
> (`/nodes` subpath) — the source-of-truth for the `field/rich-text` registry
> item. **World:** Head / cross-product. **Status:** current; feeds registry
> in pivot.

## Responsibility

Owns the `RichTextEditor` React component, the Plate plugin configuration
(`basicPlugins`), serialization helpers, and the default node → component map
(`nodeComponents`). Ships as a normal npm dependency; consumers either use it
directly or receive it pre-wired in the `field/rich-text` registry item.

Does **not** own field-level `value`/`onChange` wiring to TanStack Form (that
lives in the `field/rich-text` vended widget), CMS-specific schema validation,
or any Effect code.

## Public API / Registry Items

### Root import (`@voila/rich-text-editor`)

```ts
import { RichTextEditor }  from "@voila/rich-text-editor"
import type { RichTextEditorProps, Value, Descendant } from "@voila/rich-text-editor"
import { basicPlugins }    from "@voila/rich-text-editor"
import { toHtml, toJson, toPlainText } from "@voila/rich-text-editor"
```

`RichTextEditor` is a controlled component:

```tsx
<RichTextEditor
  value={value}           // Plate Value (Descendant[])
  onChange={setValue}
  plugins={basicPlugins}
  components={nodeComponents}
  readOnly={false}
/>
```

### `/nodes` subpath (`@voila/rich-text-editor/nodes`)

```ts
import { nodeComponents } from "@voila/rich-text-editor/nodes"
// Record<PluginKey, React.ComponentType> — plug directly into <RichTextEditor>

import {
  H1Element, H2Element, H3Element,
  BoldLeaf, ItalicLeaf, UnderlineLeaf, StrikethroughLeaf, CodeLeaf,
  BlockquoteElement,
  LinkElement,
  BulletedListElement, NumberedListElement, ListItemElement, ListItemContentElement,
} from "@voila/rich-text-editor/nodes"
```

Node components are **independently importable** so a consumer can override one
key while keeping the rest of `nodeComponents`:

```ts
import { nodeComponents } from "@voila/rich-text-editor/nodes"
import { MyH1 } from "~/components/my-h1"
const components = { ...nodeComponents, [H1Plugin.key]: MyH1 }
```

### Registry item role

`@voila/content-registry` contains a `field/rich-text` item. When added via `voila add
field/rich-text`, the consumer receives a widget file that wires
`RichTextEditor` into TanStack Form — using this package as an npm import, not
copying its source.

## How it feeds the registry

The `field/rich-text` registry item (in `@voila/content-registry`) imports:
```ts
import { RichTextEditor, basicPlugins } from "@voila/rich-text-editor"
import { nodeComponents } from "@voila/rich-text-editor/nodes"
```

These remain as npm imports in the vended widget; the consumer installs
`@voila/rich-text-editor` as a regular dependency. No source is copied except
the thin widget wrapper (which is CMS-specific wiring, not this package).

## Dependencies

- `platejs` — Slate-based rich text engine (editor core types)
- `@platejs/basic-nodes` — bold, italic, underline, strikethrough, code, h1–h3, blockquote
- `@platejs/link` — link node plugin
- `@platejs/list-classic` — bulleted / numbered lists, list-item
- `react` — peer dependency

## Usage

```tsx
// Minimal standalone usage (outside the CMS field system)
import { RichTextEditor, basicPlugins } from "@voila/rich-text-editor"
import { nodeComponents } from "@voila/rich-text-editor/nodes"
import { useState } from "react"
import type { Value } from "@voila/rich-text-editor"

const initial: Value = [{ type: "p", children: [{ text: "" }] }]

export function MyEditor() {
  const [value, setValue] = useState<Value>(initial)
  return (
    <RichTextEditor
      value={value}
      onChange={setValue}
      plugins={basicPlugins}
      components={nodeComponents}
    />
  )
}
```

```tsx
// Vended field/rich-text widget (owned by consumer after voila add field/rich-text)
// app/components/admin/widgets/rich-text-widget.tsx
import { RichTextEditor, basicPlugins } from "@voila/rich-text-editor"
import { nodeComponents } from "@voila/rich-text-editor/nodes"
import type { FieldWidgetProps } from "~/components/admin/widgets/types"

export function RichTextWidget({ field, value, onChange }: FieldWidgetProps<"rich-text">) {
  return (
    <RichTextEditor
      value={value ?? []}
      onChange={onChange}
      plugins={basicPlugins}
      components={nodeComponents}
    />
  )
}
```

## Replaces

- `packages/rich-text-editor/` at repo root — **this is the same package**; no
  rename. The pivot changes nothing in the source; the package is re-classified
  as the upstream for a registry item rather than a direct `@voila/content`
  dependency.
- The planned `rich-text-widget.tsx` inside `content/src/admin/widgets/` — that
  widget moves to the `field/rich-text` registry item in `@voila/content-registry`,
  importing this package as a dep.

## Testing

- Vitest + happy-dom: `RichTextEditor` renders without error with `basicPlugins`
  + `nodeComponents`; serializers (`toHtml`, `toPlainText`) return expected
  strings for a known `Value` fixture.
- Node component isolation: each leaf/element renders given a minimal Slate node
  prop; assert text content and class names.
- `/nodes` subpath: `nodeComponents` keys match `basicPlugins` plugin keys
  (prevents silent mismatches when Plate upgrades a key name).
