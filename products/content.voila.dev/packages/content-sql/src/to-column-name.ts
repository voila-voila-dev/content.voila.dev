// @voila/content-sql — camelCase → snake_case column name mapping.
// Pure, no Effect deps. Shared by DDL derivation (M1) and query compilation.

/**
 * Convert a camelCase identifier to snake_case.
 *
 * Rules (chosen here, documented for goldens):
 * - Insert `_` before every uppercase letter that follows a lowercase letter
 *   or digit: `createdAt` → `created_at`, `htmlURL` → `html_url`.
 * - Insert `_` before an uppercase letter that is followed by a lowercase
 *   letter when preceded by another uppercase letter, so consecutive
 *   acronyms split at the boundary: `XMLParser` → `xml_parser`.
 * - Lowercase the whole result.
 *
 * The function is intentionally pure and total — invalid identifiers (empty
 * string, non-ASCII) round-trip unchanged-ish; callers are expected to feed
 * it valid TS field names.
 */
export function toColumnName(camelCase: string): string {
  // Acronym → word boundary: `htmlURL` → `html_uRL`, `XMLParser` → `XML_Parser`
  const acronymSplit = camelCase.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");
  // lower/digit → upper boundary: `createdAt` → `created_At`
  const camelSplit = acronymSplit.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  return camelSplit.toLowerCase();
}
