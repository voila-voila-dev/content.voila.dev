import type { Descendant, TElement, TText, Value } from "platejs";

// Markdown ⇄ Plate round-trip for the `markdown` field kind lives next door (it
// pulls in the Plate markdown serializer + a headless editor); re-exported here
// so `@voila/rich-text-editor/serialize` is the one serialization entry point.
export { fromMarkdown, type MarkdownFlavor, type MarkdownOptions, toMarkdown } from "./markdown.ts";

/**
 * Returns the document unchanged. The editor's value is already JSON (a Slate
 * node tree), so this is the canonical `json` output — provided as a named
 * helper to mirror {@link toHtml} / {@link toPlainText}.
 */
export function toJson(value: Value): Value {
  return value;
}

/** Flattens the document to its text content, one block per line. */
export function toPlainText(value: Value): string {
  return value.map(nodeText).join("\n");
}

/** Serializes the document to a self-contained HTML string. */
export function toHtml(value: Value): string {
  return value.map(serializeNode).join("");
}

function isText(node: Descendant): node is TText {
  return typeof (node as { text?: unknown }).text === "string";
}

function nodeText(node: Descendant): string {
  if (isText(node)) return node.text;
  const element = node as TElement;
  // A mention is a void node (its child text is empty); surface its label.
  if (element.type === "mention") return `@${mentionLabel(element)}`;
  // An image is a void node; surface its caption/alt as the text content.
  if (element.type === "image") return imageText(element);
  // A placeholder has no text content worth flattening.
  if (element.type === "image_placeholder") return "";
  return node.children.map(nodeText).join("");
}

/** Plain-text stand-in for an image: its caption, falling back to alt text. */
function imageText(node: TElement): string {
  if (typeof node.caption === "string") return node.caption;
  return typeof node.alt === "string" ? node.alt : "";
}

/** The display label of a mention element (`label`, falling back to `value`). */
function mentionLabel(node: TElement): string {
  if (typeof node.label === "string") return node.label;
  return typeof node.value === "string" ? node.value : "";
}

function serializeNode(node: Descendant): string {
  return isText(node) ? serializeText(node) : serializeElement(node);
}

function serializeText(node: TText): string {
  let html = escapeHtml(node.text);
  if (node.code) html = `<code>${html}</code>`;
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.underline) html = `<u>${html}</u>`;
  if (node.strikethrough) html = `<s>${html}</s>`;
  return html;
}

function serializeElement(node: TElement): string {
  const inner = node.children.map(serializeNode).join("");
  switch (node.type) {
    case "h1":
    case "h2":
    case "h3":
    case "blockquote":
    case "ul":
    case "ol":
    case "li":
      return `<${node.type}>${inner}</${node.type}>`;
    case "a": {
      const url = typeof node.url === "string" ? node.url : "#";
      return `<a href="${escapeAttr(url)}">${inner}</a>`;
    }
    // Mentions are inline void atoms: render the label, not the (empty) child.
    case "mention": {
      const value = typeof node.value === "string" ? node.value : "";
      return `<span class="voila-rich-text-mention" data-mention="${escapeAttr(value)}">@${escapeHtml(mentionLabel(node))}</span>`;
    }
    // Images are block void atoms: render the figure, not the (empty) child.
    case "image":
      return serializeImage(node);
    // A placeholder is an editor-only transient; nothing to render statically.
    case "image_placeholder":
      return "";
    // List-item-content and other transparent wrappers contribute their
    // children without an extra block element.
    case "lic":
      return inner;
    default:
      return `<p>${inner}</p>`;
  }
}

/** A self-contained `<figure>` for an image element (url + optional caption). */
function serializeImage(node: TElement): string {
  const url = typeof node.url === "string" ? node.url : "";
  const alt = typeof node.alt === "string" ? node.alt : "";
  const img = `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" />`;
  const caption =
    typeof node.caption === "string" ? `<figcaption>${escapeHtml(node.caption)}</figcaption>` : "";
  return `<figure class="voila-rich-text-image">${img}${caption}</figure>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
