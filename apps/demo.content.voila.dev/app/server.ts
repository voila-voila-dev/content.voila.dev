// Custom TanStack Start server entry. It's the default Start handler (same as
// `@tanstack/react-start/server-entry`) plus the per-user sandbox Durable Object
// re-exported as a Worker class binding. The Cloudflare vite plugin does
// `export *` over `wrangler.main`, so naming `SandboxDO` here surfaces it to the
// Worker; TanStack auto-detects `app/server.ts` as the server entry, so both
// plugins resolve to this one module.

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

export { SandboxDO } from "./lib/sandbox-do";

export default { fetch: createStartHandler(defaultStreamHandler) };
