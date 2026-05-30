// Unit: the session `Rpc.Middleware`. `SessionMiddlewareLive` resolves to the
// function the RPC runtime invokes per request — given the wire headers it must
// provide the `CurrentSession` (cookie present) or fail with the typed
// `Unauthorized` (cookie absent). A stub `Auth` keeps it deterministic; the
// type-level wiring (`.middleware(SessionMiddleware)` → handlers may
// `yield* CurrentSession`) is guaranteed by `RpcMiddleware.Tag`.

import { describe, expect, it } from "bun:test";
import { Effect, Layer } from "effect";
import { Auth, AuthSession, CurrentSession } from "./auth";
import { Unauthorized } from "./errors";
import { SessionMiddleware, SessionMiddlewareLive } from "./middleware";

const session = new AuthSession({ userId: "u1", email: "admin@acme.com", expiresAt: new Date() });

// Resolve sessions purely from the `cookie` header, mirroring how Better Auth
// reads the request without spinning up the real instance.
const stubAuth = Layer.succeed(Auth, {
  getSession: (req) => Effect.succeed(req.headers.get("cookie") === "valid" ? session : null),
  requireSession: (req) =>
    req.headers.get("cookie") === "valid"
      ? Effect.succeed(session)
      : Effect.fail(new Unauthorized({ message: "No active session." })),
  handler: () => Effect.succeed(new Response()),
});

const layer = SessionMiddlewareLive.pipe(Layer.provide(stubAuth));

const invoke = (headers: Record<string, string>) =>
  Effect.gen(function* () {
    const middleware = yield* SessionMiddleware;
    // The RPC runtime passes `{ clientId, rpc, payload, headers }`; only the
    // headers are read here, so a minimal options object is cast through
    // `unknown` to the function's parameter type.
    const options = { clientId: 0, rpc: {}, payload: {}, headers } as unknown as Parameters<
      typeof middleware
    >[0];
    return yield* middleware(options);
  }).pipe(Effect.provide(layer));

describe("SessionMiddleware", () => {
  it("provides the CurrentSession when a valid cookie is present", async () => {
    const resolved = await Effect.runPromise(invoke({ cookie: "valid" }));
    expect(resolved).toBeInstanceOf(AuthSession);
    expect(resolved.email).toBe("admin@acme.com");
  });

  it("fails with Unauthorized when no session cookie is present", async () => {
    const exit = await Effect.runPromiseExit(invoke({}));
    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
      expect(exit.cause.error).toBeInstanceOf(Unauthorized);
    }
  });

  it("declares CurrentSession as what it provides", () => {
    expect(SessionMiddleware.provides).toBe(CurrentSession);
  });
});
