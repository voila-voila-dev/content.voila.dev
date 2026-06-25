// Server-side runtime: the D1 database, the magic-link authenticator, and the
// voila REST handler — all built from the Worker's bindings + secrets by
// `createWorkerAdmin`. Imported only from server route handlers and server
// functions (the dashboard counts + session guard). Swap this one line if you
// ever move off Cloudflare.

import { createWorkerAdmin } from "@voila/content-admin/cloudflare";
import config from "../../content.config";

// `dev` drops a pinned `VOILA_BASE_URL` under `vite dev` so magic-link sign-in
// targets the local origin (vite replaces `import.meta.env.DEV` with `false` in
// the production build, so the deployed Worker still pins its origin).
export const runtime = createWorkerAdmin(config, { dev: import.meta.env.DEV });
