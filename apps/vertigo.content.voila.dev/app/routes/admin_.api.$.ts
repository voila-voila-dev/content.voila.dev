// The `/admin/api` mount: Better Auth routes (`/admin/api/auth/*`), the voila
// REST handler, and the signed CSRF cookie reads need — all from the runtime in
// `lib/server.ts`, which is bound to this site's own D1.
//
// Unlike the demo, NOTHING is forwarded anywhere: there is no Durable Object and
// no per-visitor sandbox. Every write lands in the same database the public
// pages read, which is the whole point of merging the two apps.
//
// The trailing underscore on `admin_` keeps this route out of `admin.tsx`'s
// React guard layout — the REST handler does its own auth + CSRF + RBAC.

import { createFileRoute } from "@tanstack/react-router";
import { createApiHandler } from "@voila/content-admin/server";
import { runtime } from "../lib/server";

const handler = createApiHandler(runtime);
const handle = ({ request }: { request: Request }): Promise<Response> => handler(request);

export const Route = createFileRoute("/admin_/api/$")({
  server: {
    handlers: { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle },
  },
});
