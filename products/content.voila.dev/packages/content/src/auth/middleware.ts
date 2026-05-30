// Session enforcement as an `Rpc.Middleware`. Attach `SessionMiddleware` to a
// procedure (or a whole `RpcGroup` via `.middleware(SessionMiddleware)`) and its
// handler can `yield* CurrentSession` for the typed identity; an absent/expired
// session short-circuits with the typed `Unauthorized` error (envelope
// `code: "UNAUTHORIZED"`). The same `Auth.requireSession` underpins the HttpApi
// middleware when the Rpc→HttpApi derivation lands.

import { RpcMiddleware } from "@effect/rpc";
import { Effect, Layer } from "effect";
import { Auth, CurrentSession } from "./auth";
import { Unauthorized } from "./errors";

/** RPC middleware tag: provides `CurrentSession`, fails with `Unauthorized`. */
export class SessionMiddleware extends RpcMiddleware.Tag<SessionMiddleware>()(
  "@voila/content-auth/SessionMiddleware",
  { provides: CurrentSession, failure: Unauthorized },
) {}

/** Reconstruct a `Request` carrying the wire headers (notably `cookie`). */
const requestFromHeaders = (headers: Record<string, string>): Request =>
  new Request("http://localhost", { headers: new Headers(headers) });

/** Live `SessionMiddleware` over the `Auth` service. */
export const SessionMiddlewareLive: Layer.Layer<SessionMiddleware, never, Auth> = Layer.effect(
  SessionMiddleware,
  Effect.gen(function* () {
    const auth = yield* Auth;
    return ({ headers }) => auth.requireSession(requestFromHeaders(headers));
  }),
);
