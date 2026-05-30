// Public client types. The Effect-native client is exactly the typed nested
// `RpcClient` derived from the config-typed group (`client.posts.find(...)` →
// `Effect<Post, NotFound>`); the async client is its Promise mirror for
// imperative call sites that aren't running inside an `Effect`.

import type { RpcClient } from "@effect/rpc";
import type { NormalizedConfig } from "../config/config";
import type { VoilaDocFor, VoilaRpcs } from "../server/types";

/** Shared transport options for both client flavours. */
export interface VoilaClientOptions {
  /** RPC endpoint URL. Defaults to the relative `VOILA_RPC_PATH`. */
  readonly url?: string;
  /** Override the HTTP client layer (defaults to `FetchHttpClient.layer`). */
  readonly httpClient?: import("effect").Layer.Layer<
    import("@effect/platform").HttpClient.HttpClient
  >;
  /** Override wire serialization (defaults to JSON). */
  readonly serialization?: import("effect").Layer.Layer<
    import("@effect/rpc").RpcSerialization.RpcSerialization
  >;
}

/** The Effect-native typed client: `client.<slug>.list/find/findOne` → `Effect`. */
export type VoilaClient<C extends NormalizedConfig> = RpcClient.RpcClient<VoilaRpcs<C>>;

export interface ListInput {
  readonly limit?: number;
  readonly cursor?: string;
  readonly orderBy?: string;
  readonly direction?: "asc" | "desc";
}

export interface ListPage<Doc> {
  readonly documents: ReadonlyArray<Doc>;
  readonly nextCursor: string | null;
}

export interface FindInput {
  readonly id: string;
}

export interface FindOneInput {
  readonly field: string;
  readonly value: string | number | boolean;
}

/** Promise-returning read methods for one collection. */
export interface AsyncCollectionClient<Doc> {
  list(input?: ListInput): Promise<ListPage<Doc>>;
  find(input: FindInput): Promise<Doc>;
  findOne(input: FindOneInput): Promise<Doc | null>;
}

/** The Promise-based client mirror, keyed by collection slug. */
export type VoilaAsyncClient<C extends NormalizedConfig> = {
  readonly [Slug in keyof C["collections"] & string]: AsyncCollectionClient<VoilaDocFor<C, Slug>>;
};
