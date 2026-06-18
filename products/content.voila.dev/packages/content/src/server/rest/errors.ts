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
  /** Set when the denial is field-level: one issue per field the principal may not touch. */
  readonly issues?: ReadonlyArray<ValidationIssue>;
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

/**
 * One field-level failure: where it occurred and what was wrong. The shared
 * currency of every field-addressable error — `VALIDATION`, `CONFLICT`, and
 * field-level `FORBIDDEN` all carry `issues: ValidationIssue[]`, so a client
 * needs one code path to map an error onto form fields.
 */
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
  /** One issue per colliding unique field; empty when the driver doesn't name the column. */
  readonly issues: ReadonlyArray<ValidationIssue>;
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
  return {
    code: "CONFLICT",
    collectionSlug,
    issues: field === undefined ? [] : [{ path: [field], message: "Already in use." }],
  };
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
        ...(fields === undefined
          ? {}
          : { issues: fields.map((field) => ({ path: [field], message: "Not allowed." })) }),
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

// ---------- human-readable summary ----------

function formatIssue(issue: ValidationIssue): string {
  return issue.path.length === 0 ? issue.message : `${issue.path.join(".")}: ${issue.message}`;
}

// The issues a field-addressable failure carries, mirroring the client's
// `failureIssues` — the only codes that flatten to a `{ path, message }` list.
function issuesOf(failure: ApiFailure): ReadonlyArray<ValidationIssue> {
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

// Fallback sentence per code, used when a failure carries no richer context.
const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "The request was malformed.",
  UNKNOWN_COLLECTION: "No such collection.",
  UNKNOWN_FIELD: "No such field.",
  FIELD_NOT_UNIQUE: "That field is not unique.",
  INVALID_ORDER: "Cannot order by that key.",
  INVALID_CURSOR: "The pagination cursor was malformed.",
  NOT_FOUND: "Not found.",
  VALIDATION: "One or more fields are invalid.",
  CONFLICT: "A unique field already has this value.",
  INTERNAL: "An unexpected error occurred.",
  UNAUTHORIZED: "Authentication is required.",
  FORBIDDEN: "You don't have access to this resource.",
  CSRF: "The CSRF token was missing or invalid.",
  TOO_LARGE: "The upload is too large.",
};

/**
 * A human-readable, standalone summary of an `ApiFailure` — what a direct
 * (curl/non-JS) caller reads when it can't reconstruct one from the typed code.
 * Prefers the failure's own structured context (issues, slug, field, cap); the
 * typed `error` stays the source of truth, so clients still branch on `code`.
 */
export function failureMessage(failure: ApiFailure): string {
  const issues = issuesOf(failure);
  if (issues.length > 0) return issues.map(formatIssue).join(" ");
  switch (failure.code) {
    case "UNKNOWN_COLLECTION":
      return `Unknown collection "${failure.slug}".`;
    case "UNKNOWN_FIELD":
      return `Unknown field "${failure.field}" on "${failure.collectionSlug}".`;
    case "FIELD_NOT_UNIQUE":
      return `Field "${failure.field}" on "${failure.collectionSlug}" is not unique.`;
    case "INVALID_ORDER":
      return `Cannot order "${failure.collectionSlug}" by "${failure.orderKey}".`;
    case "NOT_FOUND":
      return `No "${failure.collectionSlug}" matched.`;
    case "TOO_LARGE":
      return `The upload exceeds the maximum of ${failure.maxBytes} bytes.`;
    default:
      return DEFAULT_MESSAGE[failure.code];
  }
}

// ---------- wire envelope ----------

/**
 * The on-the-wire error body: the typed discriminated `error` (the contract a
 * client narrows on `code`) plus a human-readable `message` summarizing it, so a
 * direct/non-JS caller has something to show without reconstructing one.
 */
export interface ErrorEnvelope {
  readonly error: ApiFailure;
  readonly message: string;
}

/** Render an `ApiFailure` as the standard error-envelope `Response`. */
export function errorResponse(failure: ApiFailure): Response {
  const envelope: ErrorEnvelope = { error: failure, message: failureMessage(failure) };
  return Response.json(envelope, { status: STATUS[failure.code] });
}
