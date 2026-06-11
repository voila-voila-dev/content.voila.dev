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
export { redactDocument } from "./field-access";
export {
  handleFindByField,
  handleFindById,
  handleList,
  type RestContext,
} from "./handlers";
export {
  handleMediaDelete,
  handleMediaFile,
  handleMediaGet,
  handleMediaList,
  handleMediaUpload,
  MEDIA_SEGMENT,
  type MediaContext,
} from "./media";
export {
  handleGetRevision,
  handleListRevisions,
  handleRestoreRevision,
} from "./revisions";
export { createRestHandler, type RestHandlerOptions } from "./router";
export {
  handleCreate,
  handleDelete,
  handlePublish,
  handleRestore,
  handleUnpublish,
  handleUpdate,
  validateWrite,
} from "./write";
