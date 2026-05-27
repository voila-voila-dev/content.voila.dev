/**
 * Server-only entry for the REST read API. Imported by the route files that the
 * `voila()` vite plugin generates into the consumer's `src/routes/admin/api/`
 * tree. Pulls in `@voila/content-database` + `drizzle-orm`, so never import this
 * from client/browser code.
 */

export type { BaseError } from "../shared/errors.ts";
export type { Result } from "../shared/result.ts";
export { err, ok } from "../shared/result.ts";
export type { ApiSessionResolver } from "./auth.ts";
export { requireApiSession } from "./auth.ts";
export {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfSetCookie,
  generateCsrfToken,
  issueCsrf,
  verifyCsrf,
} from "./csrf.ts";
export type {
  ApiErrorCode,
  ApiFailure,
  BadRequestError,
  ConflictError,
  CsrfError,
  ErrorEnvelope,
  FieldNotUniqueError,
  InternalError,
  InvalidCursorError,
  InvalidOrderError,
  NotFoundError,
  UnauthorizedError,
  UnknownCollectionError,
  UnknownFieldError,
  ValidationError,
} from "./errors.ts";
export {
  badRequest,
  conflict,
  csrfFailed,
  errorResponse,
  fieldNotUnique,
  internalFailure,
  invalidCursor,
  invalidOrder,
  notFound,
  unauthorized,
  unknownCollection,
  unknownField,
  validationFailed,
} from "./errors.ts";
export type { ReadHandlerContext, WriteHandlerContext } from "./handlers/index.ts";
export {
  handleCreate,
  handleCsrfToken,
  handleDelete,
  handleFindByField,
  handleFindById,
  handleList,
  handleRestore,
  handleUpdate,
} from "./handlers/index.ts";
export type { ValidatableCollection } from "./validate.ts";
export { validateWrite, validateWritePartial } from "./validate.ts";
