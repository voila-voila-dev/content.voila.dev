// Auth server functions the admin routes call. `fetchSession` resolves the
// current session server-side (from the request cookies) so the `/admin` guard
// can redirect a signed-out visitor before any admin UI renders. Wrapped in
// `createServerFn` so the server-only `./server` import (database + auth) never
// reaches the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "./server";

/** The signed-in user as the admin UI needs it. */
export interface SessionUser {
  readonly id: string;
  readonly email: string | null;
}

/** Resolve the session for the current request, or `null` when signed out. */
export const fetchSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ user: SessionUser } | null> => {
    const principal = await auth.authenticator.authenticate(getRequest());
    if (!principal) return null;
    return { user: { id: principal.id, email: principal.email ?? null } };
  },
);
