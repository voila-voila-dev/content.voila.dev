// Client-side form validation. Mirrors the server's `validateWrite` contract so
// the form rejects the same payloads the REST write path would: an empty value
// fails only if the field is required (otherwise it is omitted), and a present
// value is checked against the field's own Standard Schema. Returns the decoded
// values plus a per-field error map — no exceptions, so the form can render
// every error at once.

import type { Field } from "@voila/content";
import type { Doc } from "./doc";

export interface FormValidation {
  /** Decoded values for the fields that validated (empty optionals omitted). */
  readonly values: Doc;
  /** Field key → first error message, for the fields that failed. */
  readonly errors: Readonly<Record<string, string>>;
}

/** Treat `undefined`/`null`/`""` as "not provided", like an absent write key. */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Concatenated leaf text of a rich-text node tree (mirrors the display widget). */
function richTextText(node: unknown): string {
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
 * optional field absent.
 */
function isBlank(field: Field, value: unknown): boolean {
  if (isEmpty(value)) return true;
  if (field.meta.kind === "richText") {
    return !Array.isArray(value) || value.map(richTextText).join("").trim() === "";
  }
  return false;
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
): Readonly<Record<string, string>> {
  const inner = field.inner ?? field;
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out: Record<string, string> = {};
  for (const locale of locales) {
    const v = record[locale];
    if (isBlank(inner, v)) {
      if (field.meta.required === true) out[locale] = "Required.";
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
): FormValidation {
  const out: Doc = {};
  const errors: Record<string, string> = {};
  for (const name of keys ?? Object.keys(fields)) {
    const field = fields[name];
    if (!field) continue;
    const value = values[name];
    if (isFieldBlank(field, value)) {
      if (field.meta.required === true) errors[name] = "Required.";
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
