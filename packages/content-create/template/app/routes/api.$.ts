// The /api mount: Better Auth routes (/api/auth/*), the voila REST handler, and
// the signed CSRF cookie reads need — all from the runtime in `lib/server.ts`.

import { createFileRoute } from "@tanstack/react-router";
import { createApiHandler } from "@voila/content-admin/server";
import { runtime } from "../lib/server";

const handler = createApiHandler(runtime);
const handle = ({ request }: { request: Request }): Promise<Response> => handler(request);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle },
  },
});
