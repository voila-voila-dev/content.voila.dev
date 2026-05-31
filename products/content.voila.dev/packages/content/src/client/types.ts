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

/** A field-value record for a write. Validated server-side against the collection
 *  schema (the form validates the same schema client-side), so it's `unknown`-typed
 *  here — the typed *return* is the document. */
export type WriteInput = Record<string, unknown>;

export interface CreateInput {
  readonly data: WriteInput;
}
export interface UpdateInput {
  readonly id: string;
  readonly data: WriteInput;
}
export interface DeleteInput {
  readonly id: string;
  readonly hard?: boolean;
}
export interface DeleteResult {
  readonly id: string;
  readonly hard: boolean;
}
export interface RestoreInput {
  readonly id: string;
}

/** Promise-returning read + write methods for one collection. */
export interface AsyncCollectionClient<Doc> {
  list(input?: ListInput): Promise<ListPage<Doc>>;
  find(input: FindInput): Promise<Doc>;
  findOne(input: FindOneInput): Promise<Doc | null>;
  create(input: CreateInput): Promise<Doc>;
  update(input: UpdateInput): Promise<Doc>;
  delete(input: DeleteInput): Promise<DeleteResult>;
  restore(input: RestoreInput): Promise<Doc>;
}

/** The Promise-based client mirror, keyed by collection slug. */
export type VoilaAsyncClient<C extends NormalizedConfig> = {
  readonly [Slug in keyof C["collections"] & string]: AsyncCollectionClient<VoilaDocFor<C, Slug>>;
};
