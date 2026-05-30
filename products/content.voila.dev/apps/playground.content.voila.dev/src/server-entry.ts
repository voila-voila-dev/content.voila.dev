// Cloudflare worker entry. TanStack Start has no file-based server-route
// primitive (its default `server-entry` just default-exports `{ fetch }`), so we
// wrap `createStartHandler` and hand `/admin/api/*` to the engine (`makeVoilaFetch`)
// before falling through to the SSR handler for everything else. `env`/`ctx` are
// forwarded so TanStack Start (and the D1 binding) work as usual.
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { makeVoilaFetch, type VoilaEnv } from "~/server/voila";

const startFetch = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request, env: VoilaEnv, ctx: unknown): Response | Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/admin/api/")) {
      return makeVoilaFetch(env)(request);
    }
    // biome-ignore lint/suspicious/noExplicitAny: forward CF (request, env, ctx) to the SSR handler verbatim.
    return (startFetch as (...args: any[]) => Response | Promise<Response>)(request, env, ctx);
  },
};
