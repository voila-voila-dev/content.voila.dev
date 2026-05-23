/**
 * Server-layer error vocabulary.
 *
 * Each failure mode is its own interface extending `BaseError`. Subtypes
 * narrow `code` to a string literal and carry the structured fields the
 * caller already knows about (collection slug, field name, …). The
 * discriminated union `ApiFailure` is what flows through
 * `Result<T, ApiFailure>` at the handler boundary; individual helpers expose
 * narrower unions in their signatures so the compiler tracks exactly which
 * failures each layer can produce.
 *
 * Real exceptions (driver bugs, programming errors) still propagate to the
 * handler boundary, where `internalFailure` collapses them to `InternalError`.
 */

import type { BaseError } from "../shared/errors.ts";

export interface BadRequestError extends BaseError {
  readonly code: "BAD_REQUEST";
  readonly details?: unknown;
}

export interface UnknownCollectionError extends BaseError {
  readonly code: "UNKNOWN_COLLECTION";
  readonly slug: string;
}

export interface UnknownFieldError extends BaseError {
  readonly code: "UNKNOWN_FIELD";
  readonly collectionSlug: string;
  readonly field: string;
}

export interface FieldNotUniqueError extends BaseError {
  readonly code: "FIELD_NOT_UNIQUE";
  readonly collectionSlug: string;
  readonly field: string;
}

export interface InvalidOrderError extends BaseError {
  readonly code: "INVALID_ORDER";
  readonly collectionSlug: string;
  readonly orderKey: string;
}

export interface InvalidCursorError extends BaseError {
  readonly code: "INVALID_CURSOR";
}

export interface NotFoundError extends BaseError {
  readonly code: "NOT_FOUND";
  readonly collectionSlug: string;
}

export interface InternalError extends BaseError {
  readonly code: "INTERNAL";
}

/** Discriminated union of every error the server layer can produce. */
export type ApiFailure =
  | BadRequestError
  | UnknownCollectionError
  | UnknownFieldError
  | FieldNotUniqueError
  | InvalidOrderError
  | InvalidCursorError
  | NotFoundError
  | InternalError;

export type ApiErrorCode = ApiFailure["code"];

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNKNOWN_COLLECTION: 404,
  UNKNOWN_FIELD: 404,
  FIELD_NOT_UNIQUE: 400,
  INVALID_ORDER: 400,
  INVALID_CURSOR: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

// ---------- typed constructors ----------

export function badRequest(details?: unknown): BadRequestError {
  return details === undefined ? { code: "BAD_REQUEST" } : { code: "BAD_REQUEST", details };
}

export function unknownCollection(slug: string): UnknownCollectionError {
  return { code: "UNKNOWN_COLLECTION", slug };
}

export function unknownField(collectionSlug: string, field: string): UnknownFieldError {
  return { code: "UNKNOWN_FIELD", collectionSlug, field };
}

export function fieldNotUnique(collectionSlug: string, field: string): FieldNotUniqueError {
  return { code: "FIELD_NOT_UNIQUE", collectionSlug, field };
}

export function invalidOrder(collectionSlug: string, orderKey: string): InvalidOrderError {
  return { code: "INVALID_ORDER", collectionSlug, orderKey };
}

export function invalidCursor(): InvalidCursorError {
  return { code: "INVALID_CURSOR" };
}

export function notFound(collectionSlug: string): NotFoundError {
  return { code: "NOT_FOUND", collectionSlug };
}

/**
 * Collapse an unexpected thrown value (db driver error, programming bug) into
 * a generic 500 failure. Driver internals never reach the wire.
 */
export function internalFailure(_cause: unknown): InternalError {
  return { code: "INTERNAL" };
}

// ---------- wire envelope ----------

/** The on-the-wire error body. Carries the discriminator + any structured fields the error type defines. */
export interface ErrorEnvelope {
  error: ApiFailure;
}

/** Turn an `ApiFailure` into the standard envelope `Response`. */
export function errorResponse(apiFailure: ApiFailure): Response {
  const envelope: ErrorEnvelope = { error: apiFailure };
  return Response.json(envelope, { status: STATUS[apiFailure.code] });
}
