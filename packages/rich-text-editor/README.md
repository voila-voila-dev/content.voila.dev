# @voila/rich-text-editor

The Voila rich-text editor, built on [Plate](https://platejs.org) (which sits
on [Slate](https://slatejs.org)). Ships the plugin set, a headless
`<RichTextEditor>`, the `mention()` factory, HTML/JSON/plaintext serialization,
and the default node components.

Behavior and presentation stay separable: the editor renders nodes with
whatever `components` map you hand it. The default set lives at
[`@voila/rich-text-editor/nodes`](./src/nodes) — use it as-is, cherry-pick
individual components, or pass your own to fully restyle/extend rendering. See
[`docs.md`](./docs.md) for the design and roadmap.

## Install

```sh
bun add @voila/rich-text-editor
```

`react` and `react-dom` are peer dependencies.

## Usage

```tsx
import { useState } from "react";
import { RichTextEditor, type Value } from "@voila/rich-text-editor";
import { nodeComponents } from "@voila/rich-text-editor/nodes";
import "@voila/rich-text-editor/styles.css";

export function BodyField() {
  const [value, setValue] = useState<Value>();
  return <RichTextEditor value={value} onChange={setValue} components={nodeComponents} />;
}
```

### Serialization

```ts
import { toHtml, toJson, toPlainText } from "@voila/rich-text-editor/serialize";

toHtml(value); // "<h1>…</h1>…"
toPlainText(value); // "…"
toJson(value); // the Slate value (identity)
```

### Adding plugins

`basicPlugins` covers bold, italic, underline, strikethrough, inline code,
H1–H3, blockquote, links, and bulleted/numbered lists. Extend it:

```tsx
import { RichTextEditor, basicPlugins } from "@voila/rich-text-editor";
import { mention } from "@voila/rich-text-editor/mention";

<RichTextEditor plugins={[...basicPlugins, mention({ source: "users" })]} />;
```

### Overriding a node

`nodeComponents` is a plain map keyed by plugin key. Spread it and replace what
you need:

```tsx
import { H1Plugin } from "@platejs/basic-nodes/react";
import { nodeComponents } from "@voila/rich-text-editor/nodes";
import { PlateElement, type PlateElementProps } from "platejs/react";

function FancyH1(props: PlateElementProps) {
  return <PlateElement {...props} as="h1" className="fancy-heading" />;
}

const components = { ...nodeComponents, [H1Plugin.key]: FancyH1 };
```

Each default component is also exported individually from
`@voila/rich-text-editor/nodes`: `BoldLeaf`, `ItalicLeaf`, `UnderlineLeaf`,
`StrikethroughLeaf`, `CodeLeaf`, `H1Element`, `H2Element`, `H3Element`,
`BlockquoteElement`, `LinkElement`, `BulletedListElement`,
`NumberedListElement`, `ListItemElement`, `ListItemContentElement`.

## Exports

| Entry                                | Contents                                               |
| ------------------------------------ | ------------------------------------------------------ |
| `@voila/rich-text-editor`            | `RichTextEditor`, `basicPlugins`, serialization, types |
| `@voila/rich-text-editor/nodes`      | `nodeComponents` map + each node's React component     |
| `@voila/rich-text-editor/mention`    | `mention()` plugin factory                             |
| `@voila/rich-text-editor/serialize`  | `toHtml`, `toJson`, `toPlainText`                      |
| `@voila/rich-text-editor/styles.css` | Base surface + default node styles                     |
