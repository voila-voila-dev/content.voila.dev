// The Worker entry: the default TanStack Start handler (same as
// `@tanstack/react-start/server-entry`), named explicitly so `wrangler.main` and
// the Start plugin agree on one module. Nothing else is exported — this site has
// no Durable Objects, no queues, no auth.

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

export default { fetch: createStartHandler(defaultStreamHandler) };
