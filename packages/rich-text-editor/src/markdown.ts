// Markdown ⇄ Plate serialization for the `markdown` field kind. Unlike the
// `richText` wire adapter (JSON ⇄ JSON, in `./content/wire`), a `markdown` field
// stores a **string**: rich editing means deserializing that string into the
// editor's Plate value on mount and serializing back to markdown on change.
//
// Built on `@platejs/markdown`, which already knows how to round-trip the classic
// list shape (`ul > li > lic`) — but only when the editor it is given has the
// classic-list plugins registered (it resolves node types through the editor's
// plugin keys). So we keep a single headless slate editor configured with the
// E1 node set (the same kinds `basicPlugins` enables), built lazily so importing
// `toHtml`/`toPlainText` from this subpath doesn't pull the editor in.
//
// This module is framework-free (no `platejs/react`) — it uses the `Base*`
// (non-React) plugin variants, which carry the same keys/types as their React
// twins, so a value the live editor produces serializes here unchanged.

import {
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseItalicPlugin,
  BaseStrikethroughPlugin,
  BaseUnderlinePlugin,
} from "@platejs/basic-nodes";
import { BaseLinkPlugin } from "@platejs/link";
import {
  BaseBulletedListPlugin,
  BaseListItemContentPlugin,
  BaseListItemPlugin,
  BaseNumberedListPlugin,
} from "@platejs/list-classic";
import { deserializeMd, MarkdownPlugin, serializeMd } from "@platejs/markdown";
import { createSlateEditor, type SlateEditor, type Value } from "platejs";
import remarkGfm from "remark-gfm";

/**
 * The markdown dialects the rich editor can round-trip. `mdx` is intentionally
 * absent — it cannot be edited losslessly, so the widget keeps a raw textarea
 * for it rather than calling these functions.
 */
export type MarkdownFlavor = "commonmark" | "gfm";

export interface MarkdownOptions {
  /** Markdown dialect; `gfm` enables tables/strikethrough/etc. Defaults to `gfm`. */
  readonly flavor?: MarkdownFlavor;
}

let cached: SlateEditor | undefined;

/** The shared headless editor. `serializeMd`/`deserializeMd` never mutate it. */
function editor(): SlateEditor {
  cached ??= createSlateEditor({
    plugins: [
      BaseBoldPlugin,
      BaseItalicPlugin,
      BaseUnderlinePlugin,
      BaseStrikethroughPlugin,
      BaseCodePlugin,
      BaseH1Plugin,
      BaseH2Plugin,
      BaseH3Plugin,
      BaseBlockquotePlugin,
      BaseLinkPlugin,
      BaseBulletedListPlugin,
      BaseNumberedListPlugin,
      BaseListItemPlugin,
      BaseListItemContentPlugin,
      MarkdownPlugin,
    ],
  });
  return cached;
}

/** GFM adds the remark transforms for `~~strikethrough~~`, tables, etc. */
function remarkPlugins(flavor: MarkdownFlavor) {
  return flavor === "gfm" ? [remarkGfm] : [];
}

/**
 * Marks that have no markdown spelling for the given flavor, serialized as plain
 * text (mark dropped, text kept) instead of throwing. `underline` has no
 * markdown form in any flavor; `strikethrough` only exists under GFM.
 */
function plainMarks(flavor: MarkdownFlavor): string[] {
  return flavor === "gfm" ? ["underline"] : ["underline", "strikethrough"];
}

/** Serializes a Plate editor value to a markdown string for the given flavor. */
export function toMarkdown(value: Value, opts?: MarkdownOptions): string {
  const flavor = opts?.flavor ?? "gfm";
  return serializeMd(editor(), {
    value,
    remarkPlugins: remarkPlugins(flavor),
    plainMarks: plainMarks(flavor),
  });
}

/** Parses a markdown string into a Plate editor value (the E1 node set). */
export function fromMarkdown(markdown: string, opts?: MarkdownOptions): Value {
  const flavor = opts?.flavor ?? "gfm";
  return deserializeMd(editor(), markdown, { remarkPlugins: remarkPlugins(flavor) });
}
