/**
 * Derive a human-readable label from a field key when no explicit `label`
 * is set on the field def. Splits camelCase / snake_case / kebab-case and
 * title-cases each word:
 *
 *   "title"         → "Title"
 *   "publishedAt"   → "Published At"
 *   "site_name"     → "Site Name"
 *   "defaultLocale" → "Default Locale"
 *
 * Acronyms keep their casing on the trailing characters ("siteURL" →
 * "Site URL") since we only force the first letter of each word up.
 */
export function humanizeFieldName(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
