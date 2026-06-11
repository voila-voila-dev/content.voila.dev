// Flatten a document's localized fields to one locale. Client-safe and pure:
// the REST layer applies it for `?locale=` reads, and a host holding a full
// record (an admin form, say) can resolve the same way without a round trip.
// Non-localized fields, system columns, and absent values pass through
// untouched; a localized record picks the first locale along the chain (see
// `localeChain`) carrying a non-null value.

import type { Field } from "./schema/fields/_base";
import type { FieldsMap } from "./schema/fields/_map";

/** Pick the first non-null per-locale value along the chain, else undefined. */
function pickLocale(record: Readonly<Record<string, unknown>>, chain: ReadonlyArray<string>) {
  for (const locale of chain) {
    const value = record[locale];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/**
 * Replace every localized field's `Record<locale, T>` with the value for the
 * first locale in `chain` that has one. Returns the same document reference
 * when nothing was localized.
 */
export function localizeDocument(
  fields: FieldsMap,
  doc: Readonly<Record<string, unknown>>,
  chain: ReadonlyArray<string>,
): Readonly<Record<string, unknown>> {
  let out: Record<string, unknown> | null = null;
  for (const [name, field] of Object.entries(fields) as Array<[string, Field]>) {
    if (field.meta.localized !== true) continue;
    const value = doc[name];
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    if (out === null) out = { ...doc };
    out[name] = pickLocale(value as Readonly<Record<string, unknown>>, chain);
  }
  return out ?? doc;
}
