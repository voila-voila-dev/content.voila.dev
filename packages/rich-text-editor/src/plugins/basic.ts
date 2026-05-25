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

/**
 * The default plugin set: bold, italic, underline, strikethrough, inline code,
 * H1–H3, blockquote, links, and bulleted/numbered lists. This is the baseline
 * every consumer gets; extend it by spreading and appending your own plugins
 * (e.g. `[...basicPlugins, mention({ source: "users" })]`).
 */
export const basicPlugins = [
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  BlockquotePlugin,
  LinkPlugin,
  BulletedListPlugin,
  NumberedListPlugin,
  ListItemPlugin,
  ListItemContentPlugin,
];
