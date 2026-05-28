// Public barrel for the rich-text submodule. Re-exports the field
// constructor, every built-in element/mark, the core types, and the
// extension helpers — so the parent package can in turn surface this
// as a single `rt` namespace.

export type {
  Align,
  RichTextElement,
  RichTextElementDef,
  RichTextLeaf,
  RichTextMarkDef,
  RichTextNode,
  RichTextValue,
} from "./_core";
export { alignSchema, child, defineElement, defineMark, element } from "./_core";

export { defaultElements, defaultMarks } from "./defaults";
// Elements
export { type BlockquoteElement, blockquote } from "./elements/blockquote";
export { type BulletListElement, bulletList } from "./elements/bullet-list";
export { type CalloutElement, callout } from "./elements/callout";
export { type CodeBlockElement, codeBlock } from "./elements/code-block";
export { type EmbedElement, embed } from "./elements/embed";
export { type EmbedPlaceholderElement, embedPlaceholder } from "./elements/embed-placeholder";
export { type FileElement, file } from "./elements/file";
export { type FilePlaceholderElement, filePlaceholder } from "./elements/file-placeholder";
export { type Heading1Element, heading1 } from "./elements/heading-1";
export { type Heading2Element, heading2 } from "./elements/heading-2";
export { type Heading3Element, heading3 } from "./elements/heading-3";
export { type Heading4Element, heading4 } from "./elements/heading-4";
export { type Heading5Element, heading5 } from "./elements/heading-5";
export { type Heading6Element, heading6 } from "./elements/heading-6";
export { type HorizontalRuleElement, horizontalRule } from "./elements/horizontal-rule";
export { type ImageElement, image } from "./elements/image";
export { type ImagePlaceholderElement, imagePlaceholder } from "./elements/image-placeholder";
export { type LinkElement, link } from "./elements/link";
export { type ListItemElement, listItem } from "./elements/list-item";
export { type MentionElement, mention } from "./elements/mention";
export { type OrderedListElement, orderedList } from "./elements/ordered-list";
export { type ParagraphElement, paragraph } from "./elements/paragraph";
export { type TableElement, table } from "./elements/table";
export { type TableCellElement, tableCell } from "./elements/table-cell";
export { type TableHeaderElement, tableHeader } from "./elements/table-header";
export { type TableRowElement, tableRow } from "./elements/table-row";
export { type VideoElement, video } from "./elements/video";
export { type VideoPlaceholderElement, videoPlaceholder } from "./elements/video-placeholder";
export { type RichTextOpts, richText } from "./field";

// Marks
export { backgroundColor } from "./marks/background-color";
export { bold } from "./marks/bold";
export { code } from "./marks/code";
export { color } from "./marks/color";
export { fontFamily } from "./marks/font-family";
export { fontSize } from "./marks/font-size";
export { highlight } from "./marks/highlight";
export { italic } from "./marks/italic";
export { kbd } from "./marks/kbd";
export { strikethrough } from "./marks/strikethrough";
export { subscript } from "./marks/subscript";
export { superscript } from "./marks/superscript";
export { underline } from "./marks/underline";
