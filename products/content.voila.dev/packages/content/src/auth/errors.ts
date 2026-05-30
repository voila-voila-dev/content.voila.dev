// Typed auth errors. `Unauthorized` crosses the `@effect/rpc` wire as a
// `Schema.TaggedError` (the session middleware's declared `failure`), so the
// client surfaces it as a typed failure mapping to envelope `code: "UNAUTHORIZED"`.

import { Data, Schema } from "effect";

/** No valid session for the request. Envelope `code: "UNAUTHORIZED"`. */
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {
  message: Schema.String,
}) {}

/** A mailer transport failed to deliver a magic-link email. */
export class MailerError extends Data.TaggedError("MailerError")<{
  readonly mailer: string;
  readonly cause: unknown;
}> {}
