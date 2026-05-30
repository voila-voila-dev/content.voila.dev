// VENDED by @voila/content-registry — you own this file.
// Server-only: composes the full `Content` (Database + Better Auth) from the
// client-safe inputs in `~/content.config` and serves the engine's HTTP surfaces
// under `/admin/api/*`. Selects the `SqlClient` connection from the worker `env`
// (Cloudflare D1 in production / `wrangler dev`, a local SQLite file otherwise).
//
// Built lazily on the first request so the auth `baseUrl` can be the real request
// origin (drives the magic-link verify URL + cookie domain). The handler + its DB
// connection live for the worker's lifetime in a long-lived scope.
import { HttpApp } from "@effect/platform";
import { defineContent } from "@voila/content";
import { Auth, type MailerEnv } from "@voila/content/auth";
import { makeHandler } from "@voila/content/server";
// D1 only — the worker always runs on Cloudflare (workerd), where `bun:sqlite`
// isn't available, so we must not pull `SqliteLive` into this bundle.
import { type D1Binding, D1Live } from "@voila/content/sql";
import { Context, Effect, Layer, Scope } from "effect";
import { authBrand, branding, collections } from "~/content.config";

// Extends `MailerEnv` so the worker `env` (which also carries RESEND/SMTP vars)
// feeds the mailer resolver directly.
export interface VoilaEnv extends MailerEnv {
  /** Cloudflare D1 binding (see `wrangler.jsonc`). Absent in non-CF contexts. */
  readonly DATABASE?: D1Binding;
  /** Optional override for the session/magic-link signing secret. */
  readonly VOILA_SECRET?: string;
}

// A 32+ char dev fallback; production sets `VOILA_SECRET` as a Wrangler secret.
const DEV_SECRET = "voila-playground-dev-secret-change-me-please";

const build = (env: VoilaEnv | undefined, baseUrl: string) => {
  if (!env?.DATABASE) {
    throw new Error("voila: the `DATABASE` D1 binding is required (see wrangler.jsonc).");
  }
  const database = D1Live({ binding: env.DATABASE });

  const content = defineContent({
    branding,
    collections,
    database,
    auth: { baseUrl, brand: authBrand },
    secret: env?.VOILA_SECRET ?? DEV_SECRET,
    env: env ?? {},
  });

  return Effect.runPromise(
    Effect.gen(function* () {
      // A persistent scope so the DB connection + Better Auth instance outlive
      // this build effect (the worker keeps the module warm across requests).
      const scope = yield* Scope.make();
      const inScope = <A, E>(eff: Effect.Effect<A, E, Scope.Scope>) =>
        eff.pipe(Effect.provideService(Scope.Scope, scope));

      const app = yield* inScope(makeHandler(content));
      const rpc = HttpApp.toWebHandler(app);

      // `content.auth` is defined because we passed an `auth` block above.
      const authLayer = content.auth ?? Layer.die("auth layer missing");
      const ctx = yield* inScope(Layer.build(authLayer));
      const auth = Context.get(ctx, Auth);

      return { rpc, auth } as const;
    }),
  );
};

let built: ReturnType<typeof build> | undefined;

/**
 * The `/admin/api/*` request handler. Routes Better Auth (`/admin/api/auth/*`)
 * and the typed RPC read app (`/admin/api/rpc`); everything else 404s (the host
 * router serves the UI). Bound per `env`; memoized across requests.
 */
export const makeVoilaFetch =
  (env: VoilaEnv | undefined) =>
  async (request: Request): Promise<Response> => {
    if (!built) built = build(env, new URL(request.url).origin);
    const { rpc, auth } = await built;
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/admin/api/auth/")) return Effect.runPromise(auth.handler(request));
    if (pathname === "/admin/api/rpc") return rpc(request);
    return new Response("Not Found", { status: 404 });
  };
