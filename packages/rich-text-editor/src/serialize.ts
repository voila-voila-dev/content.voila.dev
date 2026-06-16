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
  return node.children.map(nodeText).join("");
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
    // List-item-content and other transparent wrappers contribute their
    // children without an extra block element.
    case "lic":
      return inner;
    default:
      return `<p>${inner}</p>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
