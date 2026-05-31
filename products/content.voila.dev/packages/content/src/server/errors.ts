// Typed RPC errors. These cross the `@effect/rpc` wire as `Schema.TaggedError`s,
// so the Effect-native client surfaces them as typed failures. Each maps to a
// stable envelope `code` (see `./envelope`) for the REST/HttpApi derivation.

import { Schema } from "effect";

/** A document requested by primary key does not exist. Envelope `code: "NOT_FOUND"`. */
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  collection: Schema.String,
  id: Schema.String,
}) {}

/** The request was malformed (unknown `orderBy`/lookup field, bad input).
 *  Envelope `code: "BAD_REQUEST"`. */
export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", {
  message: Schema.String,
}) {}

/** An unexpected failure (query/infrastructure error). Envelope `code: "INTERNAL"`. */
export class InternalError extends Schema.TaggedError<InternalError>()("InternalError", {
  message: Schema.String,
}) {}

/** Write input failed schema validation. Envelope `code: "VALIDATION"`; `fields`
 *  maps each rejected field name to its messages (mirrors the shared client decode). */
export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  collection: Schema.String,
  fields: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) }),
}) {}

/** A unique constraint was violated. Envelope `code: "CONFLICT"`. */
export class ConflictError extends Schema.TaggedError<ConflictError>()("ConflictError", {
  collection: Schema.String,
  field: Schema.NullOr(Schema.String),
  message: Schema.String,
}) {}

/** The request failed CSRF verification. Envelope `code: "FORBIDDEN"`. */
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}

/** The closed union of errors any read procedure can fail with. */
export type VoilaRpcError = NotFound | BadRequest | InternalError;

/** Errors a write procedure can fail with (beyond the middleware's `Unauthorized`
 *  / `Forbidden`). `NotFound` only applies to update/delete/restore. */
export type VoilaWriteError = ValidationError | ConflictError | NotFound | InternalError;
