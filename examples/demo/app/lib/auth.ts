// `fetchSession` resolves the current session server-side (from the request
// cookies) so the root guard can redirect a signed-out visitor before any admin
// UI renders. Wrapped in `createServerFn` so the server-only `./server` import
// never reaches the client bundle.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveSession, type SessionUser } from "@voila/content-admin/server";
import { runtime } from "./server";

export type { SessionUser };

export const fetchSession = createServerFn({ method: "GET" }).handler(() =>
  resolveSession(runtime.auth.authenticator, getRequest()),
);
