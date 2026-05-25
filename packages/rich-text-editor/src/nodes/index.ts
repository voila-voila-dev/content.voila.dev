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
import { BlockquoteElement } from "./blockquote-element.tsx";
import { BoldLeaf } from "./bold-leaf.tsx";
import { BulletedListElement } from "./bulleted-list-element.tsx";
import { CodeLeaf } from "./code-leaf.tsx";
import { H1Element } from "./h1-element.tsx";
import { H2Element } from "./h2-element.tsx";
import { H3Element } from "./h3-element.tsx";
import { ItalicLeaf } from "./italic-leaf.tsx";
import { LinkElement } from "./link-element.tsx";
import { ListItemContentElement } from "./list-item-content-element.tsx";
import { ListItemElement } from "./list-item-element.tsx";
import { NumberedListElement } from "./numbered-list-element.tsx";
import { StrikethroughLeaf } from "./strikethrough-leaf.tsx";
import { UnderlineLeaf } from "./underline-leaf.tsx";

export { BlockquoteElement } from "./blockquote-element.tsx";
export { BoldLeaf } from "./bold-leaf.tsx";
export { BulletedListElement } from "./bulleted-list-element.tsx";
export { CodeLeaf } from "./code-leaf.tsx";
export { H1Element } from "./h1-element.tsx";
export { H2Element } from "./h2-element.tsx";
export { H3Element } from "./h3-element.tsx";
export { ItalicLeaf } from "./italic-leaf.tsx";
export { LinkElement } from "./link-element.tsx";
export { ListItemContentElement } from "./list-item-content-element.tsx";
export { ListItemElement } from "./list-item-element.tsx";
export { NumberedListElement } from "./numbered-list-element.tsx";
export { StrikethroughLeaf } from "./strikethrough-leaf.tsx";
export { UnderlineLeaf } from "./underline-leaf.tsx";

/**
 * Default node → component map for the editor's `basicPlugins`.
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
