# @voila/rich-text-editor

The **behavior** half of the Voila rich-text editor, built on
[Plate](https://platejs.org) (which sits on [Slate](https://slatejs.org)).
Ships the plugin set, a headless `<RichTextEditor>`, the `mention()` factory,
and HTML/JSON/plaintext serialization.

It is presentation-agnostic: pass a `components` map to render nodes. Use
[`@voila/rich-text-nodes`](../rich-text-nodes) for the default components, or
your own to fully restyle/extend rendering. See [`docs.md`](./docs.md) for the
design and roadmap.

## Install

```sh
bun add @voila/rich-text-editor @voila/rich-text-nodes
```

`react` and `react-dom` are peer dependencies.

## Usage

```tsx
import { useState } from "react";
import { RichTextEditor, type Value } from "@voila/rich-text-editor";
import { nodeComponents } from "@voila/rich-text-nodes";
import "@voila/rich-text-editor/styles.css";
import "@voila/rich-text-nodes/styles.css";

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

## Exports

| Entry                              | Contents                                          |
| ---------------------------------- | ------------------------------------------------- |
| `@voila/rich-text-editor`          | `RichTextEditor`, `basicPlugins`, serialization, types |
| `@voila/rich-text-editor/mention`  | `mention()` plugin factory                        |
| `@voila/rich-text-editor/serialize`| `toHtml`, `toJson`, `toPlainText`                 |
| `@voila/rich-text-editor/styles.css` | Base styles for the `voila-rich-text` surface   |
