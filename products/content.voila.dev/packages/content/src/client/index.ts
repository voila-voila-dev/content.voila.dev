// `@voila/content/client` — the typed read client (M1). `makeVoilaClient` is the
// Effect-native client derived from the config-typed group via `RpcClient.make`;
// `createAsyncClient` is the Promise sugar for non-Effect call sites. Both are
// fully typed from `content.config.ts` — no codegen.

export { createAsyncClient } from "./async";
export { makeVoilaClient, voilaClientProtocol } from "./client";
export type {
  AsyncCollectionClient,
  FindInput,
  FindOneInput,
  ListInput,
  ListPage,
  VoilaAsyncClient,
  VoilaClient,
  VoilaClientOptions,
} from "./types";
