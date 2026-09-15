// "Is this value provided?" — the one definition of blankness the form layer
// shares. Validation uses it to decide whether a field counts as absent; dirty
// tracking uses it to decide whether a value actually changed.

import type { Field } from "@voila/content";

/** Treat `undefined`/`null`/`""` as "not provided", like an absent write key. */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Concatenated leaf text of a rich-text node tree (mirrors the display widget). */
export function richTextText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) return n.children.map(richTextText).join("");
  return "";
}

/**
 * Is a single value blank for write purposes? Empty scalars are blank, and so is
 * an *empty rich-text document* — the `[{ type:"p", children:[{ text:"" }] }]`
 * the editor emits when it normalises an untouched field on mount. Without this,
 * opening and saving a record would persist that empty doc instead of leaving an
 * optional field absent — and, just as importantly, merely opening a form would
 * look like an edit.
 */
export function isBlank(field: Field, value: unknown): boolean {
  if (isEmpty(value)) return true;
  if (field.meta.kind === "richText") {
    return !Array.isArray(value) || value.map(richTextText).join("").trim() === "";
  }
  // An empty list is "nothing here" for the list kinds, so removing the last
  // block or item leaves an optional field absent rather than storing `[]`.
  if (field.meta.kind === "blocks" || field.meta.kind === "array") {
    return Array.isArray(value) && value.length === 0;
  }
  return false;
}
