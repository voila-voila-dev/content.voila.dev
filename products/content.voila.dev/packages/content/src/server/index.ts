// `@voila/content/server` — the read-path RPC surface (M1). `voilaRpc` group +
// handlers over the `Database` service, typed per-collection document schemas,
// typed errors with an envelope mapping, and an `HttpApp` to mount at
// `/admin/api/rpc`. The group is typed from the config (`VoilaRpcs`), so a derived
// `RpcClient` is fully typed. Write procedures land in M2.

export { collectionDocumentSchema, systemColumns } from "./document";
export { type ErrorCode, type ErrorEnvelope, toErrorEnvelope } from "./envelope";
export { BadRequest, InternalError, NotFound, type VoilaRpcError } from "./errors";
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
export { FindOnePayload, FindPayload, ListPayload, OrderDirection } from "./schemas";
export type { CollectionRpcs, VoilaRpcs } from "./types";
