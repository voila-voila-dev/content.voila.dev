import type { AnyCollection, AnyContent } from "@voila/content";
import type { InferDoc, InferField } from "@voila/content-schema";

/**
 * System columns every generated table carries. Mirrors the server-side
 * `SystemColumns` shape, but typed for the wire: timestamps serialize through
 * `Date.toJSON` → ISO string.
 */
export interface SystemColumns {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Row shape returned by the read endpoints for a single collection or
 * singleton entry. Combines the precise field types (via the schema package's
 * `InferDoc`) with the system columns above.
 */
export type Row<E extends AnyCollection> = SystemColumns & InferDoc<E["fields"]>;

/** Query parameters accepted by `client.<collection>.list`. */
export interface ListOptions {
  /** Page size. Server enforces a maximum (default 25, max 100). */
  limit?: number;
  /** Opaque cursor token from a previous `nextCursor`. */
  cursor?: string | null;
  /**
   * Field or system column to order by. Defaults to `createdAt`.
   * Must reference a sortable field on the collection.
   */
  orderBy?: string;
  /** Sort direction. Defaults to `desc`. */
  order?: "asc" | "desc";
}

/** Response envelope returned by `list`. */
export interface ListResult<R> {
  data: R[];
  nextCursor: string | null;
}

/**
 * Exactly-one-field arguments for `findOne`. Distributes over the collection's
 * declared fields so `{ slug }`, `{ title }`, … are all valid call sites and
 * any *other* key is forbidden (typed as `?: never`), which lets the compiler
 * reject `findOne({ slug, title })` instead of letting it through under
 * structural subtyping.
 *
 * Uniqueness is enforced at the server boundary — the field's `unique: true`
 * flag isn't preserved in the field type yet, so we accept any field name at
 * the type level and let the server respond with `FIELD_NOT_UNIQUE` when the
 * caller picks a non-unique one.
 */
export type FindOneArgs<E extends AnyCollection> = {
  [K in keyof E["fields"] & string]: { [P in K]: InferField<E["fields"][P]> } & {
    [P in Exclude<keyof E["fields"] & string, K>]?: never;
  };
}[keyof E["fields"] & string];

/** Per-collection client surface. One method per M1 read endpoint. */
export interface CollectionClient<E extends AnyCollection> {
  /** `GET /:collection` — cursor-paginated list. */
  list(options?: ListOptions): Promise<ListResult<Row<E>>>;
  /** `GET /:collection/:id` — find by primary key. */
  find(args: { id: string }): Promise<Row<E>>;
  /** `GET /:collection/by/:field/:value` — find by a unique field. */
  findOne(args: FindOneArgs<E>): Promise<Row<E>>;
}

/**
 * Typed client surface. Each declared collection slug maps to a
 * `CollectionClient`. Singletons land alongside their REST endpoints in a
 * later milestone.
 */
export type ContentClient<C extends AnyContent> = {
  [Slug in keyof C["collections"]]: CollectionClient<C["collections"][Slug]>;
};

/**
 * Minimal `fetch` shape the client depends on. Narrower than `typeof fetch`
 * on purpose — Bun's lib types tack a `preconnect` method onto the global,
 * which a wrapper function (auth interceptor, retry layer, mock in tests)
 * would have no reason to implement.
 */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Options passed to `createClient`. */
export interface CreateClientOptions {
  /**
   * Base URL of the mounted REST API — typically `/admin/api` for in-app use
   * or `https://example.com/admin/api` for cross-origin consumers. A trailing
   * slash is tolerated.
   */
  baseUrl: string;
  /** Override the global `fetch` (e.g. inject auth headers via a wrapper). */
  fetch?: FetchLike;
  /** Extra `RequestInit` merged into every request (headers, credentials, …). */
  init?: RequestInit;
}
