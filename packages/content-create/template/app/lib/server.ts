// Server-side runtime: the D1 database, the magic-link authenticator, and the
// voila REST handler — all built from the Worker's bindings + secrets by
// `createWorkerAdmin`. Imported only from server route handlers and server
// functions (the dashboard counts + session guard). Swap this one line if you
// ever move off Cloudflare.

import { createWorkerAdmin } from "@voila/content-admin/cloudflare";
import config from "../../content.config";

export const runtime = createWorkerAdmin(config);
