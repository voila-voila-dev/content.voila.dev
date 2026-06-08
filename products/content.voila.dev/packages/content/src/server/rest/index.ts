// Public surface of the REST layer: the host-facing read + write handlers,
// dispatcher, and on-the-wire envelope vocabulary. Internal helpers (query
// parsing, value coercion, collection resolution) are reachable from their own
// files for tests but kept off the package surface.

export {
  type ApiErrorCode,
  type ApiFailure,
  type BaseError,
  type ErrorEnvelope,
  errorResponse,
  type ValidationIssue,
} from "./errors";
export {
  handleFindByField,
  handleFindById,
  handleList,
  type RestContext,
} from "./handlers";
export { createRestHandler, type RestHandlerOptions } from "./router";
export {
  handleCreate,
  handleDelete,
  handleRestore,
  handleUpdate,
  validateWrite,
} from "./write";
