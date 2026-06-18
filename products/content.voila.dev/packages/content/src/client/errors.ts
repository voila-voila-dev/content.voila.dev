// The client-side error raised when the REST API returns a non-2xx envelope.
// It carries the same typed `ApiFailure` the server emits, so a caller can
// `catch` and narrow on `err.failure.code` (e.g. `CONFLICT`, `VALIDATION`) with
// full discriminated-union typing — the wire contract is shared, not restated.
// The `message` summarizes the failure's `issues` — the `{ path, message }`
// list every field-addressable error (VALIDATION, CONFLICT, field-level
// FORBIDDEN) carries — so the actionable detail surfaces even when the error
// is rendered as an opaque string.

import type { ApiFailure, ValidationIssue } from "../server/rest/errors";

export type { ApiFailure, ValidationIssue };

function formatIssue(issue: ValidationIssue): string {
  return issue.path.length === 0 ? issue.message : `${issue.path.join(".")}: ${issue.message}`;
}

// Every field-addressable failure carries the same `issues: [{ path, message }]`
// shape; everything else has none. The single switch that knows which codes are
// field-addressable — both formatting and form-mapping go through it.
function failureIssues(failure: ApiFailure): ReadonlyArray<ValidationIssue> {
  switch (failure.code) {
    case "VALIDATION":
    case "CONFLICT":
      return failure.issues;
    case "FORBIDDEN":
      return failure.issues ?? [];
    default:
      return [];
  }
}

// The human-readable tail of `ContentClientError.message` — the failure's
// issues flattened to a sentence, or `null` when the code says it all.
function describeFailure(failure: ApiFailure): string | null {
  const issues = failureIssues(failure);
  if (issues.length > 0) return issues.map(formatIssue).join(" ");
  return failure.code === "CONFLICT" ? "A unique field already has this value." : null;
}

/**
 * Flatten a failure's issues to `{ field: message }` — the shape a form maps
 * onto its inputs (e.g. `CollectionForm`'s `serverErrors` prop). Each issue is
 * keyed by its top-level field (first issue per field wins). Failures without
 * issues are form-level, not field-level: `{}`.
 */
export function issuesByField(failure: ApiFailure): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of failureIssues(failure)) {
    const field = issue.path[0];
    if (field === undefined) continue;
    out[String(field)] ??= issue.message;
  }
  return out;
}

/** A failed REST call: the HTTP status plus the server's typed failure body. */
export class ContentClientError extends Error {
  readonly status: number;
  readonly failure: ApiFailure;

  /**
   * @param serverMessage the envelope's human-readable `message` (the server's
   *   `failureMessage`). Used as the message detail for failures the client
   *   can't describe from their typed fields alone — e.g. an operation-level
   *   `FORBIDDEN` becomes "You don't have access…" instead of a bare code.
   */
  constructor(status: number, failure: ApiFailure, serverMessage?: string) {
    const detail = describeFailure(failure) ?? serverMessage ?? null;
    super(
      detail === null ? `${failure.code} (${status})` : `${failure.code} (${status}): ${detail}`,
    );
    this.name = "ContentClientError";
    this.status = status;
    this.failure = failure;
  }

  /** This failure's field-level detail as `{ field: message }` (see `issuesByField`). */
  issuesByField(): Record<string, string> {
    return issuesByField(this.failure);
  }
}

/** Narrow an unknown caught value to a `ContentClientError`. */
export function isContentClientError(error: unknown): error is ContentClientError {
  return error instanceof ContentClientError;
}
