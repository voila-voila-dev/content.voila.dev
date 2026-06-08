// The client-side error raised when the REST API returns a non-2xx envelope.
// It carries the same typed `ApiFailure` the server emits, so a caller can
// `catch` and narrow on `err.failure.code` (e.g. `CONFLICT`, `VALIDATION`) with
// full discriminated-union typing — the wire contract is shared, not restated.

import type { ApiFailure } from "../server/rest/errors";

export type { ApiFailure };

/** A failed REST call: the HTTP status plus the server's typed failure body. */
export class ContentClientError extends Error {
  readonly status: number;
  readonly failure: ApiFailure;

  constructor(status: number, failure: ApiFailure) {
    super(`${failure.code} (${status})`);
    this.name = "ContentClientError";
    this.status = status;
    this.failure = failure;
  }
}

/** Narrow an unknown caught value to a `ContentClientError`. */
export function isContentClientError(error: unknown): error is ContentClientError {
  return error instanceof ContentClientError;
}
