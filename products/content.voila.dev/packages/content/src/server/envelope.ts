// Typed RPC error → REST/HttpApi error envelope mapping. The wire shape mirrors
// the documented contract `{ error: { code, ...fields } }`. The Rpc protocol
// already carries the typed error; this is the bridge the Rpc→HttpApi
// derivation (next M1 task) reuses so REST responses share one error shape.

import type { Unauthorized } from "../auth/errors";
import type { Forbidden, ValidationError, VoilaRpcError, VoilaWriteError } from "./errors";

/** A stable, transport-agnostic error code. `UNAUTHORIZED`/`FORBIDDEN` are produced
 *  by the session / CSRF middleware (`@voila/content/auth`, `./csrf`), not the
 *  procedures themselves. */
export type ErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "INTERNAL"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT";

export interface ErrorEnvelope {
  readonly error: {
    readonly code: ErrorCode;
    readonly [field: string]: unknown;
  };
}

/** Every typed error that crosses the wire and maps to an envelope. */
export type EnvelopableError = VoilaRpcError | VoilaWriteError | Unauthorized | Forbidden;

/** Map a typed RPC error to its REST envelope. */
export const toErrorEnvelope = (error: EnvelopableError): ErrorEnvelope => {
  switch (error._tag) {
    case "NotFound":
      return { error: { code: "NOT_FOUND", collection: error.collection, id: error.id } };
    case "BadRequest":
      return { error: { code: "BAD_REQUEST", message: error.message } };
    case "InternalError":
      return { error: { code: "INTERNAL", message: error.message } };
    case "ValidationError":
      return mapValidation(error);
    case "ConflictError":
      return {
        error: {
          code: "CONFLICT",
          collection: error.collection,
          field: error.field,
          message: error.message,
        },
      };
    case "Unauthorized":
      return { error: { code: "UNAUTHORIZED", message: error.message } };
    case "Forbidden":
      return { error: { code: "FORBIDDEN", message: error.message } };
  }
};

const mapValidation = (error: ValidationError): ErrorEnvelope => ({
  error: { code: "VALIDATION", collection: error.collection, fields: error.fields },
});
