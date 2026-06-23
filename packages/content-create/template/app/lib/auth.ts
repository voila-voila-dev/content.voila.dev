// Auth server functions the admin routes call. `fetchSession` resolves the
// current session server-side (from the request cookies) so the root guard
// can redirect a signed-out visitor before any admin UI renders. Wrapped in
// `createServerFn` so the server-only `./server` import (database + auth) never
// reaches the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveSession, type SessionUser } from "@voila/content-admin/server";
import { runtime } from "./server";

export type { SessionUser };

/** Resolve the session for the current request, or `null` when signed out. */
export const fetchSession = createServerFn({ method: "GET" }).handler(() =>
  resolveSession(runtime.auth.authenticator, getRequest()),
);
