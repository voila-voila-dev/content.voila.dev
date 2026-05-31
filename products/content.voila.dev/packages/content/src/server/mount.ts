// Mount `voilaRpc` as an `HttpApp`. `RpcServer.toHttpApp` yields a streaming-HTTP
// app the host router serves at `VOILA_RPC_PATH` (`/admin/api/rpc`) — keeping the
// platform runtime (and its FileSystem/Path deps) in the host, not the engine.
// The caller supplies a resolved `Database` layer (SQLite locally, D1 in the
// playground); handlers + JSON serialization are wired here.
//
// Pass `auth` to enforce a session on every procedure: the read group is wrapped
// with `SessionMiddleware`, so a request without a valid session cookie fails
// with the typed `Unauthorized` error (reads are session-only — CSRF lands on
// mutations in M2). `RpcServer` feeds each request's headers to the middleware,
// which resolves the cookie through `Auth.requireSession`.

import type { HttpApp } from "@effect/platform";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer, type Scope } from "effect";
import type { Auth } from "../auth/auth";
import { SessionMiddleware, SessionMiddlewareLive } from "../auth/middleware";
import type { NormalizedConfig } from "../config/config";
import type { Database } from "../sql/database";
import { CsrfMiddlewareLive, CsrfMiddlewareTestLive } from "./csrf";
import { makeVoilaRpcHandlers } from "./handlers";
import { makeVoilaRpc } from "./rpc";

/** The path the RPC endpoint is conventionally mounted at. */
export const VOILA_RPC_PATH = "/admin/api/rpc";

export interface VoilaRpcMountOptions<LE, AE = never> {
  /** A resolved `Database` layer (no outstanding requirements). */
  readonly database: Layer.Layer<Database, LE, never>;
  /** Wire serialization. Defaults to JSON. */
  readonly serialization?: Layer.Layer<RpcSerialization.RpcSerialization>;
  /**
   * A resolved `Auth` layer. When provided, every procedure requires a valid
   * session; omit it to serve the read path unauthenticated (tests, public reads).
   */
  readonly auth?: Layer.Layer<Auth, AE, never>;
  /**
   * The HMAC signing secret for CSRF. When set, mutation procedures enforce the
   * double-submit token; omit it (tests, read-only mounts) to accept writes without
   * a CSRF check. Write procedures always *declare* the middleware, so a permissive
   * layer is provided when no secret is given.
   */
  readonly secret?: string;
}

/**
 * Build the `HttpApp` for `voilaRpc` over the given `Database`. Run it once at
 * startup **inside the host's scope** and mount the result at `VOILA_RPC_PATH`.
 *
 * The handler/serialization/`Database` (and optional session-middleware) layer is
 * built into the ambient scope (via `Layer.build`), so the `Database` connection
 * lives for as long as that scope stays open — not just for the duration of this
 * build effect. The host must therefore run this in a long-lived scope (its
 * server runtime), not a transient `Effect.scoped` that closes immediately.
 */
export const toVoilaRpcHttpApp = <LE, AE = never>(
  config: NormalizedConfig,
  options: VoilaRpcMountOptions<LE, AE>,
): Effect.Effect<HttpApp.Default<never, Scope.Scope>, LE | AE, Scope.Scope> => {
  const handlers = makeVoilaRpcHandlers(config).pipe(Layer.provide(options.database));
  const serialization = options.serialization ?? RpcSerialization.layerJson;

  // Write procedures always declare `CsrfMiddleware`, so the server context must
  // provide it — the enforcing layer when a `secret` is given, else a permissive one.
  const csrf = options.secret ? CsrfMiddlewareLive(options.secret) : CsrfMiddlewareTestLive;

  // With `auth`, wrap the group so the server also requires `SessionMiddleware`, and
  // provide that middleware (built over the resolved `Auth` layer) into the scope.
  const group = options.auth
    ? makeVoilaRpc(config).middleware(SessionMiddleware)
    : makeVoilaRpc(config);
  const base = Layer.mergeAll(handlers, serialization, csrf);
  const context = options.auth
    ? Layer.merge(base, SessionMiddlewareLive.pipe(Layer.provide(options.auth)))
    : base;

  return Layer.build(context).pipe(
    // `group` is a union (authed vs not) of structurally-distinct `RpcGroup`s;
    // the runtime object carries its own middlewares, so the cast only erases
    // the type-level union for `toHttpApp`.
    Effect.flatMap((built) =>
      RpcServer.toHttpApp(group as ReturnType<typeof makeVoilaRpc>).pipe(Effect.provide(built)),
    ),
  ) as Effect.Effect<HttpApp.Default<never, Scope.Scope>, LE | AE, Scope.Scope>;
};
