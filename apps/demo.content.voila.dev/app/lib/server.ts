// Server-side runtime: the D1 database, the magic-link authenticator, and the
// voila REST handler — all built from the Worker's bindings + secrets by
// `createWorkerAdmin`. Imported only from server route handlers and server
// functions (the dashboard counts + session guard). Swap this one line if you
// ever move off Cloudflare.

import { createWorkerAdmin } from "@voila/content-admin/cloudflare";
import config from "../../content.config";

// Public demo: this is a throwaway sandbox, so anyone who signs in with a magic
// link is authorized — instead of the secure-by-default first-user-wins lock,
// every later visitor can sign up and try the admin. The magic-link plugin
// already auto-creates the user on first sign-in; this `access` override is what
// admits them past the RBAC guard. For a real admin, drop the `access` option to
// restore the secure default.
export const runtime = createWorkerAdmin(config, {
  access: () => true,
  // Under `vite dev` the Cloudflare plugin injects the production `VOILA_BASE_URL`
  // from `wrangler.jsonc`; `dev` drops it so the magic-link verify URL points at
  // the local dev origin instead of the live site. `false` in the prod build.
  dev: import.meta.env.DEV,
});
