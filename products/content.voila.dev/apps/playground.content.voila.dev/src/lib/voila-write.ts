// VENDED by @voila/content-registry — you own this file.
// Imperative write client. `createAsyncClient` gives Promise-returning, fully-typed
// mutations (`client.posts.create({ data })`); we inject the CSRF token in the
// `x-voila-csrf` header (the cookie rides along same-origin) so the engine's
// `CsrfMiddleware` accepts the write. Built per submit and disposed after.
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { createAsyncClient, type VoilaAsyncClient } from "@voila/content/client";
import { Effect, Layer } from "effect";
import config from "~/content.config";
import { CSRF_HEADER, getCsrfToken } from "~/lib/csrf";

type WriteClient = VoilaAsyncClient<typeof config> & { readonly dispose: () => Promise<void> };

// A `FetchHttpClient` that stamps the CSRF token on every RPC request.
const csrfHttpClient = (token: string): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (client) =>
      HttpClient.mapRequest(client, HttpClientRequest.setHeader(CSRF_HEADER, token)),
    ),
  ).pipe(Layer.provide(FetchHttpClient.layer));

/** Run `use` with a CSRF-armed write client, disposing it afterward. */
export const withWriteClient = async <A>(use: (client: WriteClient) => Promise<A>): Promise<A> => {
  const token = await getCsrfToken();
  const client = createAsyncClient(config, {
    url: "/admin/api/rpc",
    httpClient: csrfHttpClient(token),
  }) as WriteClient;
  try {
    return await use(client);
  } finally {
    await client.dispose();
  }
};
