// The authenticated caller, as the engine sees it. Deliberately minimal: an
// opaque `id`, an optional `email`, and the `roles` the RBAC hook branches on.
// Concrete auth backends (a Better Auth bridge, a JWT verifier, a test stub)
// produce this shape; nothing downstream knows how the session was established.

export interface Principal {
  /** Stable identifier for the caller (a user id, an API-key id, …). */
  readonly id: string;
  readonly email?: string;
  /** Roles the access hook can check (e.g. `["admin"]`). Empty/absent = none. */
  readonly roles?: ReadonlyArray<string>;
}

// The operations a request can map to, shared by the router (which classifies a
// route) and the access hook (which authorizes it). `read` covers both
// find-by-id and find-by-field; `list` is the collection read.
export type Operation = "list" | "read" | "create" | "update" | "delete" | "restore";
