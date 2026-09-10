// Client-side form validation. Mirrors the server's `validateWrite` contract so
// the form rejects the same payloads the REST write path would: an empty value
// fails only if the field is required (otherwise it is omitted), and a present
// value is checked against the field's own Standard Schema. Returns the decoded
// values plus a per-field error map — no exceptions, so the form can render
// every error at once.

import type { Field } from "@voila/content";
import { isBlank } from "./blank";
import type { Doc } from "./doc";

export interface FormValidation {
  /** Decoded values for the fields that validated (empty optionals omitted). */
  readonly values: Doc;
  /** Field key → first error message, for the fields that failed. */
  readonly errors: Readonly<Record<string, string>>;
}

/**
 * Is a field's value "not provided"? For a localized field that's a per-locale
 * record blank in *every* locale (omit the whole field); otherwise the single
 * value's own blankness. A partially-filled localized record is kept and handed
 * to the field's schema as-is.
 */
function isFieldBlank(field: Field, value: unknown): boolean {
  if (
    field.meta.localized === true &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const inner = field.inner ?? field;
    const locales = Object.values(value as Record<string, unknown>);
    return locales.length > 0 && locales.every((v) => isBlank(inner, v));
  }
  return isBlank(field, value);
}

/**
 * Strip the locales a user left empty out of a localized record before it meets
 * the field's schema. `required` on a localized field means "the default locale
 * is filled" — the other locales are translations that can land later — so an
 * empty translation must not be sent as `""` and must not fail validation. This
 * mirrors the engine's `localizedRecord`, which is what the server enforces.
 */
function isLocalizedBlank(pruned: unknown): boolean {
  if (typeof pruned !== "object" || pruned === null || Array.isArray(pruned)) return true;
  return Object.keys(pruned as Record<string, unknown>).length === 0;
}

function pruneEmptyLocales(field: Field, value: unknown): unknown {
  if (
    field.meta.localized !== true ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return value;
  }
  const inner = field.inner ?? field;
  const out: Record<string, unknown> = {};
  for (const [locale, v] of Object.entries(value as Record<string, unknown>)) {
    if (!isBlank(inner, v)) out[locale] = v;
  }
  return out;
}

/**
 * Per-locale validation messages for a localized field, keyed by locale. Lets
 * the form show an error under the *specific* locale that failed instead of
 * repeating the field's single message under every locale. Each locale's value
 * is checked against the inner field's own Standard Schema; a blank required
 * locale is `"Required."`. Locales that pass are absent from the map.
 */
export function localizedFieldErrors(
  field: Field,
  value: unknown,
  locales: ReadonlyArray<string>,
  defaultLocale?: string,
): Readonly<Record<string, string>> {
  const inner = field.inner ?? field;
  // Only the default locale carries `required` — see `pruneEmptyLocales`.
  const requiredLocale = defaultLocale ?? locales[0];
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const locale of locales) {
    const v = record[locale];
    if (isBlank(inner, v)) {
      if (field.meta.required === true && locale === requiredLocale) out[locale] = "Required.";
      continue;
    }
    const result = inner["~standard"].validate(v);
    if (result instanceof Promise) {
      out[locale] = "Validation did not complete.";
      continue;
    }
    if (result.issues) out[locale] = result.issues[0]?.message ?? "Invalid value.";
  }
  return out;
}

export function validateFields(
  fields: Readonly<Record<string, Field>>,
  values: Readonly<Doc>,
  keys?: ReadonlyArray<string>,
  opts?: { readonly locales?: ReadonlyArray<string>; readonly defaultLocale?: string },
): FormValidation {
  const out: Doc = {};
  const errors: Record<string, string> = {};
  const requiredLocale = opts?.defaultLocale ?? opts?.locales?.[0];
  for (const name of keys ?? Object.keys(fields)) {
    const field = fields[name];
    if (!field) continue;
    const localized = field.meta.localized === true;
    // Untranslated locales are dropped before the schema sees them, so a blank
    // translation is never persisted as `""` and never fails validation.
    const value = localized ? pruneEmptyLocales(field, values[name]) : values[name];
    if (localized ? isLocalizedBlank(value) : isFieldBlank(field, value)) {
      if (field.meta.required === true) errors[name] = "Required.";
      continue;
    }
    // A localized field whose DEFAULT locale is blank fails as "Required." even
    // when other locales are filled — that locale is the one reads fall back to.
    if (
      localized &&
      field.meta.required === true &&
      requiredLocale !== undefined &&
      !(requiredLocale in (value as Record<string, unknown>))
    ) {
      errors[name] = "Required.";
      continue;
    }
    const result = field["~standard"].validate(value);
    if (result instanceof Promise) {
      // voila fields validate synchronously; an async result is a bug, not an
      // expected state — surface it rather than awaiting in a sync helper.
      errors[name] = "Validation did not complete.";
      continue;
    }
    if (result.issues) {
      errors[name] = result.issues[0]?.message ?? "Invalid value.";
    } else {
      out[name] = result.value;
    }
  }
  return { values: out, errors };
}
