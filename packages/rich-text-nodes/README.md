# @voila/rich-text-nodes

The **presentation** half of the Voila rich-text editor. Ships the default
React components that render each node from
[`@voila/rich-text-editor`](../rich-text-editor)'s `basicPlugins` — plus a
`nodeComponents` map you pass to the editor, and individual component exports so
you can cherry-pick or override.

## Install

```sh
bun add @voila/rich-text-editor @voila/rich-text-nodes
```

## Usage

```tsx
import { RichTextEditor } from "@voila/rich-text-editor";
import { nodeComponents } from "@voila/rich-text-nodes";
import "@voila/rich-text-nodes/styles.css";

<RichTextEditor components={nodeComponents} />;
```

### Overriding a node

`nodeComponents` is a plain map keyed by plugin key. Spread it and replace what
you need:

```tsx
import { H1Plugin } from "@platejs/basic-nodes/react";
import { nodeComponents } from "@voila/rich-text-nodes";
import { PlateElement, type PlateElementProps } from "platejs/react";

function FancyH1(props: PlateElementProps) {
  return <PlateElement {...props} as="h1" className="fancy-heading" />;
}

const components = { ...nodeComponents, [H1Plugin.key]: FancyH1 };
```

## Exports

- `nodeComponents` — the default node → component map.
- Individual components: `BoldLeaf`, `ItalicLeaf`, `UnderlineLeaf`,
  `StrikethroughLeaf`, `CodeLeaf`, `H1Element`, `H2Element`, `H3Element`,
  `BlockquoteElement`, `LinkElement`, `BulletedListElement`,
  `NumberedListElement`, `ListItemElement`, `ListItemContentElement`.
- `@voila/rich-text-nodes/styles.css` — appearance for the default nodes.
