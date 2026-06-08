// The per-collection RBAC seam. A single `AccessControl` hook is consulted for
// every authenticated request: it receives the principal, the operation, the
// target collection slug, and (when the route names one) the document id, and
// returns whether to allow it. One function covers per-collection *and*
// per-operation rules — the host branches on `collection`/`operation` however it
// likes — without the engine prescribing a policy DSL.
//
// The hook only runs for authenticated requests (a `Principal` exists), so it
// presupposes an `Authenticator`. A denial maps to 403 `FORBIDDEN`.

import type { Operation, Principal } from "./principal";

export interface AccessRequest {
  readonly principal: Principal;
  readonly operation: Operation;
  readonly collection: string;
  /** The targeted document, on routes that name one (read/update/delete/restore). */
  readonly documentId?: string;
}

export type AccessControl = (request: AccessRequest) => boolean | Promise<boolean>;
