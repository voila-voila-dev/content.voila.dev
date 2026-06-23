// Map a failed write to form errors. A `ContentClientError` from a 422
// `VALIDATION` / 409 `CONFLICT` carries per-field issues (`issuesByField()`) the
// form shows inline; anything else (network, operation-level `FORBIDDEN`) has no
// field issues and falls back to the form-level banner. Lifted from the demo's
// per-collection routes, now shared by the generic create/edit screens.

import { isContentClientError } from "@voila/content/client";

/** Per-field server errors `{ field: message }`, or `undefined` when none apply. */
export function fieldErrors(error: unknown): Record<string, string> | undefined {
  if (!isContentClientError(error)) return undefined;
  const issues = error.issuesByField();
  return Object.keys(issues).length > 0 ? issues : undefined;
}

/** A human message for a form-level banner, or `undefined` for non-Errors. */
export function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}
