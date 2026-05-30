// The Effect-native client. `makeVoilaClient` derives the typed nested client
// from the config-typed group via `RpcClient.make` over an HTTP protocol
// (`@effect/rpc`), so `client.posts.find({ id })` returns
// `Effect<Post, NotFound | InternalError>`. Run it inside a scope; the client
// lives until that scope closes.

import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Effect, Layer, type Scope } from "effect";
import type { NormalizedConfig } from "../config/config";
import { VOILA_RPC_PATH } from "../server/mount";
import { makeVoilaRpc } from "../server/rpc";
import type { VoilaClient, VoilaClientOptions } from "./types";

// The relative default (`VOILA_RPC_PATH`) only resolves against a browser origin.
// `FetchHttpClient` on Bun/Node has no base for a relative path and throws
// `Invalid URL` on every request, so fall back to the relative default only in a
// browser and otherwise require an explicit absolute `url`.
const resolveUrl = (url: string | undefined): string => {
  if (url !== undefined) return url;
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (origin !== undefined) return VOILA_RPC_PATH;
  throw new Error(
    `makeVoilaClient: no \`url\` provided and no browser origin to resolve "${VOILA_RPC_PATH}" against. ` +
      `Pass \`options.url\` with an absolute URL (e.g. "http://localhost:3000${VOILA_RPC_PATH}") when running outside the browser.`,
  );
};

/** The RPC client protocol layer (HTTP + serialization), fully resolved. */
export const voilaClientProtocol = (options: VoilaClientOptions = {}) =>
  RpcClient.layerProtocolHttp({ url: resolveUrl(options.url) }).pipe(
    Layer.provide(options.httpClient ?? FetchHttpClient.layer),
    Layer.provide(options.serialization ?? RpcSerialization.layerJson),
  );

/**
 * Build the Effect-native typed client. Requires a `Scope` — use it inside
 * `Effect.scoped` (or a `ManagedRuntime`); the client is torn down with the scope.
 */
export const makeVoilaClient = <C extends NormalizedConfig>(
  config: C,
  options: VoilaClientOptions = {},
): Effect.Effect<VoilaClient<C>, never, Scope.Scope> =>
  RpcClient.make(makeVoilaRpc(config)).pipe(
    Effect.provide(voilaClientProtocol(options)),
  ) as Effect.Effect<VoilaClient<C>, never, Scope.Scope>;
