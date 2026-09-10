// Which fields the user has actually changed.
//
// The form used to flip a single `dirty` flag the first time any widget emitted
// a value. That is wrong, because widgets emit on mount as well as on edit: the
// rich-text editor normalises an untouched field to an empty document the
// moment it renders. So simply OPENING a create form marked it dirty, which
// armed the unsaved-changes guard and left the editor unable to leave a form
// they had not typed into.
//
// Dirtiness is therefore derived, not accumulated: compare the current values
// against the baseline the form opened with, treating two blank values as the
// same value whatever shape they take. A field is dirty only when its content
// really differs.

import type { Field } from "@voila/content";
import { isBlank } from "./blank";
import type { Doc } from "./doc";

/**
 * Structural equality for form values. Field values are JSON-shaped (scalars,
 * arrays, plain objects, and rich-text node trees), so a recursive walk is both
 * sufficient and cheap at form scale.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => valuesEqual(item, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.hasOwn(right, key) && valuesEqual(left[key], right[key]));
}

/**
 * Has this field changed? Two blank values are equal however they are spelled —
 * `undefined`, `""` and an empty rich-text document all mean "nothing here", so
 * a widget normalising one into another is not an edit. Localized fields compare
 * locale by locale under the same rule, so an editor that opens a form and
 * touches nothing leaves every locale clean.
 */
export function fieldIsDirty(field: Field, before: unknown, after: unknown): boolean {
  if (field.meta.localized === true) {
    const inner = field.inner ?? field;
    const beforeRecord = asRecord(before);
    const afterRecord = asRecord(after);
    const locales = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
    for (const locale of locales) {
      if (localeChanged(inner, beforeRecord[locale], afterRecord[locale])) return true;
    }
    return false;
  }
  return localeChanged(field, before, after);
}

function localeChanged(field: Field, before: unknown, after: unknown): boolean {
  if (isBlank(field, before) && isBlank(field, after)) return false;
  return !valuesEqual(before, after);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The keys whose values differ from the baseline, across the given fields. */
export function dirtyFieldKeys(
  fields: Readonly<Record<string, Field>>,
  keys: ReadonlyArray<string>,
  baseline: Readonly<Doc>,
  current: Readonly<Doc>,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const key of keys) {
    const field = fields[key];
    if (!field) continue;
    if (fieldIsDirty(field, baseline[key], current[key])) out.add(key);
  }
  return out;
}
