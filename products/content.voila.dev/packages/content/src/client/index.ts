// @voila/content/client — typed client (L5). M0 stub.
//
// Real client surface (`client.posts.list()`, …) is derived from `voilaApi`
// via `HttpApiClient.make` in M3. M0 just needs `createClient` to be importable
// and resolve to an object with a `.health()` Promise so the public symbol is
// stable.

import { Schema } from "effect";

export interface CreateClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly headers?: Record<string, string>;
}

/** Wire shape of `GET /health` — validated on every response. */
export interface HealthResponse {
  readonly ok: boolean;
}
const HealthResponseSchema: Schema.Schema<HealthResponse> = Schema.Struct({ ok: Schema.Boolean });
const decodeHealth: (input: unknown) => HealthResponse =
  Schema.decodeUnknownSync(HealthResponseSchema);

export interface ContentClient<_C = unknown> {
  readonly health: () => Promise<HealthResponse>;
}

export class ContentClientError extends Error {
  override readonly name = "ContentClientError";
  readonly code: string;

  constructor(opts: {
    readonly code: string;
    readonly message?: string;
    readonly cause?: unknown;
  }) {
    super(opts.message ?? opts.code, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.code = opts.code;
  }
}

export const createClient = <C = unknown>(options: CreateClientOptions): ContentClient<C> => {
  const doFetch = options.fetch ?? globalThis.fetch;
  const headers = options.headers ?? {};
  return {
    health: async () => {
      const url = `${options.baseUrl.replace(/\/$/, "")}/health`;
      const res = await doFetch(url, { headers });
      if (!res.ok) {
        throw new ContentClientError({
          code: `HTTP_${res.status}`,
          message: `health check failed: ${res.status}`,
        });
      }
      try {
        return decodeHealth(await res.json());
      } catch (cause) {
        throw new ContentClientError({
          code: "INVALID_RESPONSE",
          message: "health response failed schema validation",
          cause,
        });
      }
    },
  };
};
