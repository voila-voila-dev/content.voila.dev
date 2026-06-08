// REST error vocabulary + wire envelope. Each failure mode is its own interface
// narrowing `code` to a string literal and carrying the structured fields the
// caller already knows (collection slug, field name, …) — never a scraped human
// message. `ApiFailure` is the discriminated union that flows to the wire as
// `{ error }`; `ApiError` wraps one so a handler can `throw` and a single
// boundary (`runHandler`) maps it to a `Response`.
//
// Only the read path's codes live here. Writes (CONFLICT/VALIDATION/CSRF) and
// auth (UNAUTHORIZED) add their own codes when those slices land, so every
// constructor below is exercised by a real request — no dead vocabulary.

/** Base shape every failure extends: a string-literal discriminator. */
export interface BaseError {
  readonly code: string;
}

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

/** Every failure the read layer can produce. */
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

export function badRequest(details: unknown): BadRequestError {
  return { code: "BAD_REQUEST", details };
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
 * Collapse an unexpected thrown value (driver error, programming bug) into a
 * generic 500. Driver internals never reach the wire.
 */
export function internalFailure(_cause: unknown): InternalError {
  return { code: "INTERNAL" };
}

// ---------- throwable wrapper ----------

/**
 * An `ApiFailure` raised through the throw channel. Handlers throw it; the
 * `runHandler` boundary catches it and renders the envelope. Distinct from a
 * real `Error` (driver/programming bug), which the boundary folds to `INTERNAL`.
 */
export class ApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(failure.code);
    this.name = "ApiError";
    this.failure = failure;
  }
}

/** Throw an `ApiFailure`. The `never` return lets call sites stay expression-shaped. */
export function fail(failure: ApiFailure): never {
  throw new ApiError(failure);
}

// ---------- wire envelope ----------

/** The on-the-wire error body: the discriminator plus the error's own fields. */
export interface ErrorEnvelope {
  readonly error: ApiFailure;
}

/** Render an `ApiFailure` as the standard error-envelope `Response`. */
export function errorResponse(failure: ApiFailure): Response {
  const envelope: ErrorEnvelope = { error: failure };
  return Response.json(envelope, { status: STATUS[failure.code] });
}
