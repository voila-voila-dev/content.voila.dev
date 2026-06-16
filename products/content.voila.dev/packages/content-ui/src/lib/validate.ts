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
    if (isEmpty(value)) {
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
