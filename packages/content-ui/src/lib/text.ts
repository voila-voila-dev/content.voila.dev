// Plain-text helpers for read surfaces: a table cell or a card line needs a
// short, single-line preview of a long value (a rich-text document, a markdown
// body), not the whole thing. Dependency-free walks so they run anywhere.

/** Concatenate a rich-text node's leaf text (children joined without spaces, so
 *  marks split across leaves don't gain gaps). */
function nodeText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) return n.children.map(nodeText).join("");
  return "";
}

/** Flatten a `richText` value (the engine's node tree) to one whitespace-normalized string. */
export function richTextToPlain(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map(nodeText).join(" ").replace(/\s+/g, " ").trim();
}

/** Strip the most common markdown syntax so a body reads as a sentence. */
export function markdownToPlain(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut a string to `max` characters on a word boundary, with an ellipsis. */
export function truncateText(text: string, max = 120): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd()}…`;
}

/**
 * One line that says what a collapsed record holds: the first non-empty
 * string / markdown / rich-text member, in field order, clipped. Nothing
 * when the record is still empty. Shared by the blocks and object-array rows.
 */
export function recordSummary(
  record: Readonly<Record<string, unknown>>,
  fields: Readonly<Record<string, { readonly meta: { readonly kind: string } }>>,
  max = 80,
): string | undefined {
  for (const [key, field] of Object.entries(fields)) {
    const value = record[key];
    const kind = field.meta.kind;
    const text =
      kind === "richText" ? richTextToPlain(value) : typeof value === "string" ? value.trim() : "";
    if (text !== "") return truncateText(text, max);
  }
  return undefined;
}
