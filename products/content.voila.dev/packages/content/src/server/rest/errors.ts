// REST error vocabulary + wire envelope. Each failure mode is its own interface
// narrowing `code` to a string literal and carrying the structured fields the
// caller already knows (collection slug, field name, …) — never a scraped human
// message. `ApiFailure` is the discriminated union that flows to the wire as
// `{ error }`; `ApiError` wraps one so a handler can `throw` and a single
// boundary (`runHandler`) maps it to a `Response`.
//
// Read-, write-, and auth-path codes live here: UNAUTHORIZED (no/!invalid
// session), FORBIDDEN (authenticated but the RBAC hook denied the operation),
// and CSRF (double-submit token missing/mismatched/unsigned). Every constructor
// below is exercised by a real request — no dead vocabulary.

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

export interface UnauthorizedError extends BaseError {
  readonly code: "UNAUTHORIZED";
}

export interface ForbiddenError extends BaseError {
  readonly code: "FORBIDDEN";
  /** The collection and operation the principal was denied, when known. */
  readonly collectionSlug?: string;
  readonly operation?: string;
  /** Set when the denial is field-level: the fields the principal may not write. */
  readonly fields?: ReadonlyArray<string>;
}

export interface CsrfError extends BaseError {
  readonly code: "CSRF";
}

export interface TooLargeError extends BaseError {
  readonly code: "TOO_LARGE";
  /** The configured cap, in bytes. */
  readonly maxBytes: number;
  /** The rejected upload's size, when known. */
  readonly size?: number;
}

/** One field-level validation failure: where it occurred and what was wrong. */
export interface ValidationIssue {
  /** Path to the offending value, field name first (e.g. `["title"]`, `["tags", 0]`). */
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

export interface ValidationError extends BaseError {
  readonly code: "VALIDATION";
  readonly collectionSlug: string;
  readonly issues: ReadonlyArray<ValidationIssue>;
}

export interface ConflictError extends BaseError {
  readonly code: "CONFLICT";
  readonly collectionSlug: string;
  /** The unique field that collided, when the driver names the column. */
  readonly field?: string;
}

/** Every failure the read or write layer can produce. */
export type ApiFailure =
  | BadRequestError
  | UnknownCollectionError
  | UnknownFieldError
  | FieldNotUniqueError
  | InvalidOrderError
  | InvalidCursorError
  | NotFoundError
  | ValidationError
  | ConflictError
  | InternalError
  | UnauthorizedError
  | ForbiddenError
  | CsrfError
  | TooLargeError;

export type ApiErrorCode = ApiFailure["code"];

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNKNOWN_COLLECTION: 404,
  UNKNOWN_FIELD: 404,
  FIELD_NOT_UNIQUE: 400,
  INVALID_ORDER: 400,
  INVALID_CURSOR: 400,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INTERNAL: 500,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CSRF: 403,
  TOO_LARGE: 413,
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

export function validation(
  collectionSlug: string,
  issues: ReadonlyArray<ValidationIssue>,
): ValidationError {
  return { code: "VALIDATION", collectionSlug, issues };
}

export function conflict(collectionSlug: string, field?: string): ConflictError {
  return field === undefined
    ? { code: "CONFLICT", collectionSlug }
    : { code: "CONFLICT", collectionSlug, field };
}

/**
 * Collapse an unexpected thrown value (driver error, programming bug) into a
 * generic 500. Driver internals never reach the wire.
 */
export function internalFailure(_cause: unknown): InternalError {
  return { code: "INTERNAL" };
}

/** No session, or the `Authenticator` rejected the credentials. */
export function unauthorized(): UnauthorizedError {
  return { code: "UNAUTHORIZED" };
}

/**
 * Authenticated, but denied: by the RBAC hook for this operation on this
 * collection, or — when `fields` is set — by per-field `access.write` rules.
 */
export function forbidden(
  collectionSlug?: string,
  operation?: string,
  fields?: ReadonlyArray<string>,
): ForbiddenError {
  const error: ForbiddenError = { code: "FORBIDDEN" };
  return collectionSlug === undefined
    ? error
    : {
        ...error,
        collectionSlug,
        ...(operation === undefined ? {} : { operation }),
        ...(fields === undefined ? {} : { fields }),
      };
}

/** A mutating request whose CSRF double-submit token was missing or invalid. */
export function csrfFailure(): CsrfError {
  return { code: "CSRF" };
}

/** An upload exceeding the configured byte cap. */
export function tooLarge(maxBytes: number, size?: number): TooLargeError {
  return size === undefined
    ? { code: "TOO_LARGE", maxBytes }
    : { code: "TOO_LARGE", maxBytes, size };
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
