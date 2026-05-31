// `@voila/content/server` — the RPC surface. `voilaRpc` group (read trio + write
// quartet per collection) + handlers over the `Database` service, typed
// per-collection document schemas, typed errors with an envelope mapping,
// session + CSRF middleware, and an `HttpApp` to mount at `/admin/api/rpc`. The
// group is typed from the config (`VoilaRpcs`), so a derived `RpcClient` is fully
// typed (`client.posts.create(...)` and friends — no codegen).

export {
  CSRF_COOKIE,
  CSRF_HEADER,
  CsrfMiddleware,
  CsrfMiddlewareLive,
  CsrfMiddlewareTestLive,
  mintCsrfToken,
} from "./csrf";
export { collectionDocumentSchema, systemColumns } from "./document";
export {
  type EnvelopableError,
  type ErrorCode,
  type ErrorEnvelope,
  toErrorEnvelope,
} from "./envelope";
export {
  BadRequest,
  ConflictError,
  Forbidden,
  InternalError,
  NotFound,
  ValidationError,
  type VoilaRpcError,
  type VoilaWriteError,
} from "./errors";
export { type HandlerInput, makeHandler } from "./handler";
export { makeVoilaRpcHandlers } from "./handlers";
export {
  HttpSessionMiddleware,
  HttpSessionMiddlewareLive,
  makeVoilaHttpApi,
  toVoilaHttpApiWebHandler,
  VOILA_REST_PATH,
  type VoilaHttpApiOptions,
  voilaOpenApi,
} from "./httpapi";
export { toVoilaRpcHttpApp, VOILA_RPC_PATH, type VoilaRpcMountOptions } from "./mount";
export { type ListArgs, type ListPage, makeReadCore, type ReadCore } from "./read-core";
export { makeVoilaRpc } from "./rpc";
export {
  CreatePayload,
  DeletePayload,
  FindOnePayload,
  FindPayload,
  ListPayload,
  OrderDirection,
  RestorePayload,
  UpdatePayload,
} from "./schemas";
export type { CollectionRpcs, VoilaRpcs } from "./types";
export { type DeleteResult, makeWriteCore, type WriteCore } from "./write-core";
