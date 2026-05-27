/**
 * Server-only entry for the REST read API. Imported by the route files that the
 * `voila()` vite plugin generates into the consumer's `src/routes/admin/api/`
 * tree. Pulls in `@voila/content-database` + `drizzle-orm`, so never import this
 * from client/browser code.
 */

export type { BaseError } from "../shared/errors.ts";
export type { Result } from "../shared/result.ts";
export { err, ok } from "../shared/result.ts";

export type {
  ApiErrorCode,
  ApiFailure,
  BadRequestError,
  ErrorEnvelope,
  FieldNotUniqueError,
  InternalError,
  InvalidCursorError,
  InvalidOrderError,
  NotFoundError,
  UnknownCollectionError,
  UnknownFieldError,
  ValidationError,
} from "./errors.ts";
export {
  badRequest,
  errorResponse,
  fieldNotUnique,
  internalFailure,
  invalidCursor,
  invalidOrder,
  notFound,
  unknownCollection,
  unknownField,
  validationFailed,
} from "./errors.ts";
export type { ReadHandlerContext } from "./handlers/index.ts";
export { handleFindByField, handleFindById, handleList } from "./handlers/index.ts";
export type { ValidatableCollection } from "./validate.ts";
export { validateWrite } from "./validate.ts";
