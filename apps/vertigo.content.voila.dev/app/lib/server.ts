// Server-side runtime for the admin half of this app: the D1 database, the
// magic-link authenticator, the media store and the voila REST handler, all
// built from the Worker's bindings + secrets by `createWorkerAdmin`.
//
// This is also the single `Database` construction path for the whole app — the
// public site's read layer (`./content`) reads `runtime.database` rather than
// building a second one, so an edit made in `/admin` is visible on the public
// page on the very next request, with no second driver and no chance of the two
// halves drifting onto different bindings.
//
// Imported only from server route handlers and server functions.

import { createWorkerAdmin } from "@voila/content-admin/cloudflare";
import config from "../../content.config";

// NOTE: this admin deliberately passes NO `access` override, so the engine's
// secure default applies — first-user-wins: only the first account to sign in
// is admitted past the RBAC guard. That is what keeps a passer-by from signing
// themselves in and rewriting the programme. An `access: () => true` override
// is only ever safe when each visitor edits a private throwaway copy, which is
// not the case here: this admin edits the live public site.
export const runtime = createWorkerAdmin(config, {
  // The admin mounts at `/admin`, so its REST + auth routes live under
  // `/admin/api` — matching `defineAdmin`'s default `apiPath`.
  basePath: "/admin/api",
  // Under `vite dev` the Cloudflare plugin injects the production
  // `VOILA_BASE_URL` from `wrangler.jsonc`; `dev` drops it so the magic-link
  // verify URL points at the local dev origin. `false` in the prod build.
  dev: import.meta.env.DEV,
});
