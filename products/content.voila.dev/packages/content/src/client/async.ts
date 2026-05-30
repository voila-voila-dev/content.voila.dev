// `createAsyncClient` — the Promise sugar over `makeVoilaClient` for call sites
// that aren't running inside an `Effect` (imperative code, non-atom React
// handlers). It holds a long-lived scope so the underlying RPC client persists
// across calls; `dispose()` tears it down. Typed RPC failures reject the Promise
// with the original typed error (not an Effect `FiberFailure`).

import { Cause, Effect, Exit, Scope } from "effect";
import type { NormalizedConfig } from "../config/config";
import { makeVoilaClient } from "./client";
import type { VoilaAsyncClient, VoilaClientOptions } from "./types";

type AnyReadMethod = (input?: unknown) => Effect.Effect<unknown, unknown>;
type AnyClient = Record<string, Record<string, AnyReadMethod>>;

/**
 * Build a Promise-based read client. The underlying Effect client is created
 * once into a held scope; call `dispose()` to release it.
 */
export const createAsyncClient = <C extends NormalizedConfig>(
  config: C,
  options: VoilaClientOptions = {},
): VoilaAsyncClient<C> & { readonly dispose: () => Promise<void> } => {
  const scope = Effect.runSync(Scope.make());
  const ready = Effect.runPromise(
    makeVoilaClient(config, options).pipe(Effect.provideService(Scope.Scope, scope)),
  ) as Promise<AnyClient>;
  // Attach a no-op handler so a build failure (e.g. a bad url) before any method
  // is called doesn't surface as an unhandledRejection. Per-call `.then` chains
  // below each get their own rejection, so callers still observe the error.
  ready.catch(() => {});

  const call = (slug: string, method: string) => (input?: unknown) =>
    ready.then((client) => {
      const fn = (client[slug] as Record<string, AnyReadMethod>)[method] as AnyReadMethod;
      return Effect.runPromiseExit(fn(input ?? {})).then((exit) =>
        Exit.isSuccess(exit) ? exit.value : Promise.reject(Cause.squash(exit.cause)),
      );
    });

  // `dispose` is idempotent and waits for the in-flight client build to settle
  // before closing the scope. Closing first would let the RPC client be acquired
  // into an already-closed scope, so its finalizer never runs and the underlying
  // HTTP client leaks.
  let disposing: Promise<void> | undefined;
  const dispose = (): Promise<void> => {
    disposing ??= ready
      .then(
        () => undefined,
        () => undefined,
      )
      .then(() => Effect.runPromise(Scope.close(scope, Exit.void)));
    return disposing;
  };

  const api: Record<string, unknown> = { dispose };
  for (const slug of Object.keys(config.collections)) {
    api[slug] = {
      list: call(slug, "list"),
      find: call(slug, "find"),
      findOne: call(slug, "findOne"),
    };
  }
  return api as VoilaAsyncClient<C> & { readonly dispose: () => Promise<void> };
};
