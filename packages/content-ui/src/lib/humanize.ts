// Turn a field key (`publishedAt`, `cover_image`) into a human label
// (`Published At`, `Cover Image`) for headers/labels when the field carries no
// explicit `meta.label`. Splits camelCase, snake_case, and kebab-case, then
// title-cases each word. `getFieldLabel` is the shared label fallback every
// component uses (DataTable headers, DetailView rows, CollectionForm labels).

import type { Field } from "@voila/content";

/** A field's display label: explicit `meta.label`, else the humanized key. */
export function getFieldLabel(key: string, field: Field): string {
  return field.meta.label ?? humanize(key);
}

export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
