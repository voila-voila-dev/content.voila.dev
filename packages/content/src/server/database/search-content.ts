// Pure helpers for the full-text index: pick a collection's searchable fields
// and flatten a document's values into the single `content` blob the
// engine-owned `voila_search` table stores. No database access — unit-tested in
// isolation. The runtime `Database` calls these on every write to keep the index
// in sync.

import type { FieldsMap } from "../../config/schema/fields";
import type { Document } from "./types";

/**
 * Field kinds auto-selected when a collection opts into search with `true`. Text
 * the user is likely to search by — prose, identifiers, enums. Deliberately
 * excludes `secret`/`password`/`color`/`id` and the structured JSON kinds; name
 * those explicitly (`search: ["color"]`) to force them in.
 */
export const SEARCHABLE_KINDS: ReadonlySet<string> = new Set([
  "string",
  "slug",
  "markdown",
  "code",
  "enum",
  "select",
  "multiSelect",
  "richText",
]);

/** One field to index: its name and the metadata the text extractor needs. */
export interface SearchFieldInfo {
  readonly fieldName: string;
  readonly kind: string;
  readonly localized: boolean;
}

/**
 * Resolve the fields to index for a collection. `true` auto-selects the
 * text-bearing kinds; an explicit array names them verbatim (any kind, in the
 * given order). Returns `null` when search is off, or an empty array when the
 * opt-in selected nothing — both mean "don't index this collection".
 */
export function resolveSearchFields(
  fields: FieldsMap,
  option: boolean | ReadonlyArray<string> | undefined,
): ReadonlyArray<SearchFieldInfo> | null {
  if (option === undefined || option === false) return null;
  const explicit = Array.isArray(option) ? new Set(option) : null;
  const out: SearchFieldInfo[] = [];
  // An explicit list drives the order; `true` walks the declared fields.
  const names = explicit ? [...explicit] : Object.keys(fields);
  for (const fieldName of names) {
    const field = fields[fieldName];
    if (field === undefined) continue;
    const { kind, localized } = field.meta;
    if (explicit === null && !SEARCHABLE_KINDS.has(kind)) continue;
    out.push({ fieldName, kind, localized: localized === true });
  }
  return out;
}

// Flatten a rich-text value (a Plate/Slate node tree) to its leaf text. Leaves
// carry `{ text }`; containers carry `{ children }`. Anything else contributes
// nothing.
function richTextPlain(value: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node !== null && typeof node === "object") {
      const text = (node as { text?: unknown }).text;
      if (typeof text === "string") parts.push(text);
      walk((node as { children?: unknown }).children);
    }
  };
  walk(value);
  return parts.join(" ");
}

// The searchable text of one field value. Localized values (a `Record<locale,
// inner>`) index every locale; rich text flattens to leaf text; arrays join
// their entries; nested objects (other than rich text / localized) are skipped.
function fieldText(info: SearchFieldInfo, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (info.localized && typeof value === "object" && !Array.isArray(value)) {
    return Object.values(value as Record<string, unknown>)
      .map((inner) => fieldText({ ...info, localized: false }, inner))
      .join(" ");
  }
  if (info.kind === "richText") return richTextPlain(value);
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(" ");
  if (typeof value === "object") return "";
  return String(value);
}

/** Concatenate a document's searchable fields into the `content` blob. */
export function buildSearchContent(fields: ReadonlyArray<SearchFieldInfo>, doc: Document): string {
  return fields
    .map((info) => fieldText(info, doc[info.fieldName]))
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();
}

/**
 * Build the FTS5 `MATCH` query from raw user input: each whitespace-separated
 * token becomes a quoted prefix term (`"foo"* "bar"*` — implicit AND). Quoting
 * neutralizes FTS5 operators so arbitrary input can't throw a syntax error.
 * Returns `null` for a blank query (the caller short-circuits to no results).
 */
export function toMatchQuery(query: string): string | null {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(" ");
}
