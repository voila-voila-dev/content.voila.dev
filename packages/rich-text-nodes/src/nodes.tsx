import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { LinkPlugin } from "@platejs/link/react";
import {
  BulletedListPlugin,
  ListItemContentPlugin,
  ListItemPlugin,
  NumberedListPlugin,
} from "@platejs/list-classic/react";
import {
  PlateElement,
  type PlateElementProps,
  PlateLeaf,
  type PlateLeafProps,
} from "platejs/react";

// --- Marks (leaves) -------------------------------------------------------
// `as` swaps the wrapping element so the rendered DOM carries semantic tags
// (<strong>, <em>, …) that HTML serialization can rely on.

export function BoldLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="strong" />;
}
export function ItalicLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="em" />;
}
export function UnderlineLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="u" />;
}
export function StrikethroughLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="s" />;
}
export function CodeLeaf(props: PlateLeafProps) {
  return <PlateLeaf {...props} as="code" />;
}

// --- Blocks (elements) ----------------------------------------------------

export function H1Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h1" />;
}
export function H2Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h2" />;
}
export function H3Element(props: PlateElementProps) {
  return <PlateElement {...props} as="h3" />;
}
export function BlockquoteElement(props: PlateElementProps) {
  return <PlateElement {...props} as="blockquote" />;
}
export function BulletedListElement(props: PlateElementProps) {
  return <PlateElement {...props} as="ul" />;
}
export function NumberedListElement(props: PlateElementProps) {
  return <PlateElement {...props} as="ol" />;
}
export function ListItemElement(props: PlateElementProps) {
  return <PlateElement {...props} as="li" />;
}
// The list-item-content node wraps the text inside an <li>; render it as a
// transparent block so the DOM stays <li><div>…</div></li>.
export function ListItemContentElement(props: PlateElementProps) {
  return <PlateElement {...props} as="div" />;
}

export function LinkElement(props: PlateElementProps) {
  const href = (props.element as { url?: string }).url;
  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{ ...props.attributes, href } as PlateElementProps["attributes"]}
    >
      {props.children}
    </PlateElement>
  );
}

/**
 * Default node → component map for `@voila/rich-text-editor`'s `basicPlugins`.
 * Pass it to `<RichTextEditor components={nodeComponents} />`, or spread it and
 * override individual keys to customize: `{ ...nodeComponents, [H1Plugin.key]: MyH1 }`.
 * Keyed off `Plugin.key` so the wiring tracks the plugins automatically.
 */
export const nodeComponents = {
  [BoldPlugin.key]: BoldLeaf,
  [ItalicPlugin.key]: ItalicLeaf,
  [UnderlinePlugin.key]: UnderlineLeaf,
  [StrikethroughPlugin.key]: StrikethroughLeaf,
  [CodePlugin.key]: CodeLeaf,
  [H1Plugin.key]: H1Element,
  [H2Plugin.key]: H2Element,
  [H3Plugin.key]: H3Element,
  [BlockquotePlugin.key]: BlockquoteElement,
  [LinkPlugin.key]: LinkElement,
  [BulletedListPlugin.key]: BulletedListElement,
  [NumberedListPlugin.key]: NumberedListElement,
  [ListItemPlugin.key]: ListItemElement,
  [ListItemContentPlugin.key]: ListItemContentElement,
};
