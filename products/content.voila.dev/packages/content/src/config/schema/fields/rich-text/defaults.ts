// The default set of elements / marks used when a `richText({...})` field
// omits `elements` / `marks`. Splat these tuples to extend rather than
// replace:
//
//   fields.richText({ elements: [...defaultElements, math, callout2] })

import { blockquote } from "./elements/blockquote";
import { bulletList } from "./elements/bullet-list";
import { callout } from "./elements/callout";
import { codeBlock } from "./elements/code-block";
import { embed } from "./elements/embed";
import { embedPlaceholder } from "./elements/embed-placeholder";
import { file } from "./elements/file";
import { filePlaceholder } from "./elements/file-placeholder";
import { heading1 } from "./elements/heading-1";
import { heading2 } from "./elements/heading-2";
import { heading3 } from "./elements/heading-3";
import { heading4 } from "./elements/heading-4";
import { heading5 } from "./elements/heading-5";
import { heading6 } from "./elements/heading-6";
import { horizontalRule } from "./elements/horizontal-rule";
import { image } from "./elements/image";
import { imagePlaceholder } from "./elements/image-placeholder";
import { link } from "./elements/link";
import { listItem } from "./elements/list-item";
import { mention } from "./elements/mention";
import { orderedList } from "./elements/ordered-list";
import { paragraph } from "./elements/paragraph";
import { table } from "./elements/table";
import { tableCell } from "./elements/table-cell";
import { tableHeader } from "./elements/table-header";
import { tableRow } from "./elements/table-row";
import { video } from "./elements/video";
import { videoPlaceholder } from "./elements/video-placeholder";
import { backgroundColor } from "./marks/background-color";
import { bold } from "./marks/bold";
import { code } from "./marks/code";
import { color } from "./marks/color";
import { fontFamily } from "./marks/font-family";
import { fontSize } from "./marks/font-size";
import { highlight } from "./marks/highlight";
import { italic } from "./marks/italic";
import { kbd } from "./marks/kbd";
import { strikethrough } from "./marks/strikethrough";
import { subscript } from "./marks/subscript";
import { superscript } from "./marks/superscript";
import { underline } from "./marks/underline";

export const defaultElements = [
  paragraph,
  heading1,
  heading2,
  heading3,
  heading4,
  heading5,
  heading6,
  blockquote,
  bulletList,
  orderedList,
  listItem,
  horizontalRule,
  codeBlock,
  table,
  tableRow,
  tableCell,
  tableHeader,
  link,
  mention,
  image,
  imagePlaceholder,
  video,
  videoPlaceholder,
  file,
  filePlaceholder,
  embed,
  embedPlaceholder,
  callout,
] as const;

export const defaultMarks = [
  bold,
  italic,
  underline,
  strikethrough,
  code,
  subscript,
  superscript,
  highlight,
  color,
  backgroundColor,
  fontFamily,
  fontSize,
  kbd,
] as const;
