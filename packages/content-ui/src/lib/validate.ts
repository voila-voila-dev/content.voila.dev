// Client-side form validation. Mirrors the server's `validateWrite` contract so
// the form rejects the same payloads the REST write path would: an empty value
// fails only if the field is required (otherwise it is omitted), and a present
// value is checked against the field's own Standard Schema. Returns the decoded
// values plus a per-field error map — no exceptions, so the form can render
// every error at once.

import type { Field } from "@voila/content";
import { isBlank } from "./blank";
import type { Doc } from "./doc";
import { en, type Messages } from "./messages";

/**
 * One validation issue below a field: `path` is relative to the field
 * (`[2, "title"]` for the third block's title), `message` the schema's text.
 */
export interface FieldIssue {
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

export interface FormValidation {
  /** Decoded values for the fields that validated (empty optionals omitted). */
  readonly values: Doc;
  /**
   * Field key → first error message, for the fields that failed. An issue
   * nested inside a structured field keeps its sub-path in the message
   * (`[2].title: Required.`) so the field-level line still points somewhere.
   */
  readonly errors: Readonly<Record<string, string>>;
  /**
   * Field key → every issue under that field, paths relative to the field.
   * Container widgets (blocks, arrays, objects) slice these by segment
   * (`issuesUnder`) to render each message next to the nested control.
   */
  readonly issues: Readonly<Record<string, ReadonlyArray<FieldIssue>>>;
}

// Flatten a Standard Schema issue path (which may carry `{ key }` segments) to
// plain string/number segments — the same shape the REST envelope uses.
function normalizePath(
  path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined,
): Array<string | number> {
  if (!path) return [];
  return path.map((seg) => {
    const key = typeof seg === "object" ? seg.key : seg;
    return typeof key === "number" ? key : String(key);
  });
}

/** `[2].title: Required.` — an issue's message with its sub-path, when nested. */
export function formatFieldIssue(issue: FieldIssue): string {
  if (issue.path.length === 0) return issue.message;
  const sub = issue.path
    .map((seg) => (typeof seg === "number" ? `[${seg}]` : `.${seg}`))
    .join("")
    .replace(/^\./, "");
  return `${sub}: ${issue.message}`;
}

/** The issues under one segment of a field's value, re-rooted at that segment. */
export function issuesUnder(
  issues: ReadonlyArray<FieldIssue> | undefined,
  segment: string | number,
): ReadonlyArray<FieldIssue> {
  if (!issues) return [];
  return issues
    .filter((issue) => issue.path[0] === segment)
    .map((issue) => ({ path: issue.path.slice(1), message: issue.message }));
}

/**
 * The message to show right at `path` — the first issue whose path is exactly
 * `path` (a scalar's own error), else the first issue below it formatted with
 * its remaining sub-path.
 */
export function issueMessageAt(
  issues: ReadonlyArray<FieldIssue> | undefined,
  path: ReadonlyArray<string | number>,
): string | undefined {
  if (!issues) return undefined;
  const below = issues.filter(
    (issue) => issue.path.length >= path.length && path.every((seg, i) => issue.path[i] === seg),
  );
  const exact = below.find((issue) => issue.path.length === path.length);
  if (exact) return exact.message;
  const first = below[0];
  return first
    ? formatFieldIssue({ path: first.path.slice(path.length), message: first.message })
    : undefined;
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
  messages: Messages = en,
): Readonly<Record<string, string>> {
  const m = messages.form;
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
      if (field.meta.required === true && locale === requiredLocale) out[locale] = m.required;
      continue;
    }
    const result = inner["~standard"].validate(v);
    if (result instanceof Promise) {
      out[locale] = m.validationIncomplete;
      continue;
    }
    if (result.issues) out[locale] = result.issues[0]?.message ?? m.invalidValue;
  }
  return out;
}

export function validateFields(
  fields: Readonly<Record<string, Field>>,
  values: Readonly<Doc>,
  keys?: ReadonlyArray<string>,
  opts?: {
    readonly locales?: ReadonlyArray<string>;
    readonly defaultLocale?: string;
    /** The chrome messages the errors are worded in (English by default). */
    readonly messages?: Messages;
  },
): FormValidation {
  const m = (opts?.messages ?? en).form;
  const out: Doc = {};
  const errors: Record<string, string> = {};
  const issues: Record<string, ReadonlyArray<FieldIssue>> = {};
  const requiredLocale = opts?.defaultLocale ?? opts?.locales?.[0];
  for (const name of keys ?? Object.keys(fields)) {
    const field = fields[name];
    if (!field) continue;
    const localized = field.meta.localized === true;
    // Untranslated locales are dropped before the schema sees them, so a blank
    // translation is never persisted as `""` and never fails validation.
    const value = localized ? pruneEmptyLocales(field, values[name]) : values[name];
    if (localized ? isLocalizedBlank(value) : isFieldBlank(field, value)) {
      if (field.meta.required === true) errors[name] = m.required;
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
      errors[name] = m.required;
      continue;
    }
    const result = field["~standard"].validate(value);
    if (result instanceof Promise) {
      // voila fields validate synchronously; an async result is a bug, not an
      // expected state — surface it rather than awaiting in a sync helper.
      errors[name] = m.validationIncomplete;
      continue;
    }
    if (result.issues) {
      const list = result.issues.map((issue) => ({
        path: normalizePath(issue.path),
        message: issue.message,
      }));
      issues[name] = list;
      const first = list[0];
      errors[name] = first ? formatFieldIssue(first) : m.invalidValue;
    } else {
      out[name] = result.value;
    }
  }
  return { values: out, errors, issues };
}
