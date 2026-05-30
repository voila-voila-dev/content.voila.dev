// Typed RPC error → REST/HttpApi error envelope mapping. The wire shape mirrors
// the documented contract `{ error: { code, ...fields } }`. The Rpc protocol
// already carries the typed error; this is the bridge the Rpc→HttpApi
// derivation (next M1 task) reuses so REST responses share one error shape.

import type { VoilaRpcError } from "./errors";

/** A stable, transport-agnostic error code. `UNAUTHORIZED` is produced by the
 *  session middleware (`@voila/content/auth`), not the read procedures. */
export type ErrorCode = "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL" | "UNAUTHORIZED";

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ErrorCode;
    readonly [field: string]: unknown;
  };
}

/** Map a typed RPC error to its REST envelope. */
export const toErrorEnvelope = (error: VoilaRpcError): ErrorEnvelope => {
  switch (error._tag) {
    case "NotFound":
      return { error: { code: "NOT_FOUND", collection: error.collection, id: error.id } };
    case "BadRequest":
      return { error: { code: "BAD_REQUEST", message: error.message } };
    case "InternalError":
      return { error: { code: "INTERNAL", message: error.message } };
  }
};
