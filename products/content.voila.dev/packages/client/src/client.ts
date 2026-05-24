/**
 * Typed `fetch` wrapper over the M1 read endpoints. The factory is
 * type-only-generic over the consumer's `Content` — the runtime stores
 * nothing about the schema and lazily materializes a per-collection client
 * the first time a slug is accessed.
 *
 * Endpoint shapes mirror `@voila/content/server/handlers`:
 *
 *   list     GET /:collection             { data: Row[], nextCursor: string|null }
 *   find     GET /:collection/:id         { data: Row }
 *   findOne  GET /:collection/by/:f/:v    { data: Row }
 *
 * Non-2xx responses always throw `ContentClientError` with the server's
 * `code` discriminator preserved.
 */

import type { AnyCollection, AnyContent } from "@voila/content";
import { unwrap } from "./errors.ts";
import type {
  CollectionClient,
  ContentClient,
  CreateClientOptions,
  FetchLike,
  FindOneArgs,
  ListOptions,
  ListResult,
  Row,
} from "./types.ts";

interface FindResponse<R> {
  data: R;
}

function buildListUrl(base: string, collection: string, options: ListOptions): string {
  const search = new URLSearchParams();
  if (options.limit !== undefined) search.set("limit", String(options.limit));
  if (options.cursor) search.set("cursor", options.cursor);
  if (options.orderBy) search.set("orderBy", options.orderBy);
  if (options.order) search.set("order", options.order);
  const qs = search.toString();
  return `${base}/${encodeURIComponent(collection)}${qs ? `?${qs}` : ""}`;
}

/**
 * Build the per-collection client. Erased to `AnyCollection` at the runtime
 * boundary — every declared collection shares the same code path; the precise
 * row type is reconstructed at the call site via the `ContentClient<C>` type
 * argument.
 */
function makeCollectionClient(
  base: string,
  slug: string,
  fetchImpl: FetchLike,
  init: RequestInit | undefined,
): CollectionClient<AnyCollection> {
  return {
    async list(options?: ListOptions): Promise<ListResult<Row<AnyCollection>>> {
      const url = buildListUrl(base, slug, options ?? {});
      const res = await fetchImpl(url, init);
      return unwrap<ListResult<Row<AnyCollection>>>(res);
    },

    async find(args: { id: string }): Promise<Row<AnyCollection>> {
      const url = `${base}/${encodeURIComponent(slug)}/${encodeURIComponent(args.id)}`;
      const res = await fetchImpl(url, init);
      const body = await unwrap<FindResponse<Row<AnyCollection>>>(res);
      return body.data;
    },

    async findOne(args: FindOneArgs<AnyCollection>): Promise<Row<AnyCollection>> {
      const entries = Object.entries(args as Record<string, unknown>);
      if (entries.length !== 1) {
        throw new TypeError(
          `findOne expects exactly one field, got ${entries.length} (${entries.map(([k]) => k).join(", ")})`,
        );
      }
      const [field, value] = entries[0] as [string, unknown];
      const url = `${base}/${encodeURIComponent(slug)}/by/${encodeURIComponent(field)}/${encodeURIComponent(String(value))}`;
      const res = await fetchImpl(url, init);
      const body = await unwrap<FindResponse<Row<AnyCollection>>>(res);
      return body.data;
    },
  };
}

/**
 * Create a typed client for a given `Content` config.
 *
 * ```ts
 * import type content from "./content.config";
 * const client = createClient<typeof content>({ baseUrl: "/admin/api" });
 * const post = await client.posts.find({ id: "abc" });
 * ```
 *
 * The returned proxy materializes a `CollectionClient` on first access per
 * slug and memoizes it for the lifetime of the client. Unknown slugs hit the
 * server, which responds with `UNKNOWN_COLLECTION`.
 */
export function createClient<C extends AnyContent>(options: CreateClientOptions): ContentClient<C> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const fetchImpl: FetchLike = options.fetch ?? globalThis.fetch.bind(globalThis);
  const init = options.init;
  const cache = new Map<string, CollectionClient<AnyCollection>>();

  const target: Record<string, CollectionClient<AnyCollection>> = {};

  const handler: ProxyHandler<Record<string, CollectionClient<AnyCollection>>> = {
    get(_target, prop): CollectionClient<AnyCollection> | undefined {
      if (typeof prop !== "string") return undefined;
      let client = cache.get(prop);
      if (!client) {
        client = makeCollectionClient(base, prop, fetchImpl, init);
        cache.set(prop, client);
      }
      return client;
    },
  };

  return new Proxy(target, handler) as unknown as ContentClient<C>;
}
