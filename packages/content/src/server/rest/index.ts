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
  handleGetSingleton,
  handleList,
  type RestContext,
  type RestErrorHook,
  serializeRow,
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
  handleViewsCreate,
  handleViewsDelete,
  handleViewsList,
  handleViewsUpdate,
  VIEWS_SEGMENT,
  type ViewsContext,
} from "./views";
export {
  handleCreate,
  handleDelete,
  handlePublish,
  handleRestore,
  handleSetSingleton,
  handleUnpublish,
  handleUpdate,
  validateWrite,
} from "./write";
