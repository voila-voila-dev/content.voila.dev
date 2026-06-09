// The typed REST client, inferred straight from a config — no codegen. Given
// `defineConfig(...)`, `makeClient(config, ...)` returns an object with one
// accessor per collection (`client.posts.list()`, `client.posts.create(...)`,
// …), each method's argument and result types resolved from the collection's
// fields via `InferDoc`. At runtime every method is a thin `fetch` over the REST
// routes the `createRestHandler` dispatcher serves; the wire envelope is unwrapped
// to typed data, and any error envelope becomes a typed `ContentClientError`.

import type { NormalizedConfig } from "../config/config";
import type { InferDoc } from "../config/schema/infer";
import { type ApiFailure, ContentClientError } from "./errors";

/** System columns the server stamps on every row, on top of the declared fields. */
export interface SystemFields {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
}

/** A stored document: the declared field shape plus the system columns. */
export type Stored<Doc> = Doc & SystemFields;

/** A primitive usable as a unique-field lookup value. */
export type LookupValue = string | number | boolean;

/** Orderable keys: a declared field or one of the always-present system columns. */
export type OrderKey<Doc> = (keyof Doc & string) | "id" | "createdAt" | "updatedAt";

/** Draft scoping for `list` (draft-enabled collections only). */
export type DraftFilter = "published" | "draft" | "any";

export interface ListParams<Doc> {
  /** Page size (server clamps to 1–100). */
  readonly limit?: number;
  /** Field to order by; defaults server-side to `createdAt`. */
  readonly orderBy?: OrderKey<Doc>;
  /** Sort direction; defaults server-side to `desc`. */
  readonly order?: "asc" | "desc";
  /** Opaque `nextCursor` from a prior page. */
  readonly cursor?: string;
  /** Draft scoping; defaults to live published rows. Ignored for non-draft collections. */
  readonly status?: DraftFilter;
}

export interface ListPage<Doc> {
  readonly data: ReadonlyArray<Stored<Doc>>;
  readonly nextCursor: string | null;
}

/** The per-collection method surface, typed from the collection's document shape. */
export interface CollectionClient<Doc> {
  /** Page through live rows (keyset pagination). */
  list(params?: ListParams<Doc>): Promise<ListPage<Doc>>;
  /** Fetch one row by id, or `null` if it's missing or soft-deleted. */
  find(id: string): Promise<Stored<Doc> | null>;
  /** Fetch the row matching a unique field, or `null` if none match. */
  findBy(field: keyof Doc & string, value: LookupValue): Promise<Stored<Doc> | null>;
  /** Create a row from a full field payload; returns the stored row. */
  create(data: Doc): Promise<Stored<Doc>>;
  /** Patch a subset of a row's fields; returns the stored row. */
  update(id: string, data: Partial<Doc>): Promise<Stored<Doc>>;
  /** Soft-delete a row. */
  delete(id: string): Promise<void>;
  /** Restore a soft-deleted row; returns the restored row. */
  restore(id: string): Promise<Stored<Doc>>;
  /** Publish a row (draft-enabled collections); `at` schedules a future go-live. */
  publish(id: string, opts?: { at?: number }): Promise<Stored<Doc>>;
  /** Return a row to draft (draft-enabled collections). */
  unpublish(id: string): Promise<Stored<Doc>>;
}

/** The typed client surface: one `CollectionClient` per configured collection. */
export type ContentClient<C extends NormalizedConfig> = {
  readonly [Slug in keyof C["collections"] & string]: CollectionClient<InferDoc<C, Slug>>;
};

export interface ClientOptions {
  /**
   * Base the REST routes mount under (e.g. `/admin/api`). Root-relative works in
   * the browser; tests and server-to-server callers pass an absolute URL.
   */
  readonly baseUrl: string;
  /** Fetch implementation; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
}

/** The on-the-wire envelope every endpoint returns (success or error). */
interface Envelope {
  readonly data?: unknown;
  readonly nextCursor?: string | null;
  readonly error?: ApiFailure;
}

// Fallback when a non-2xx response has no parseable error body — the call still
// failed, so surface a generic INTERNAL rather than a misleading success.
const INTERNAL: ApiFailure = { code: "INTERNAL" };

const enc = encodeURIComponent;

function trimBase(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function listQuery<Doc>(params: ListParams<Doc> | undefined): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.orderBy !== undefined) qs.set("orderBy", params.orderBy);
  if (params.order !== undefined) qs.set("order", params.order);
  if (params.cursor !== undefined) qs.set("cursor", params.cursor);
  if (params.status !== undefined) qs.set("status", params.status);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

function jsonBody(data: unknown): RequestInit {
  return { headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) };
}

function makeCollectionClient(
  slug: string,
  base: string,
  fetchImpl: typeof fetch,
): CollectionClient<unknown> {
  const root = `${base}/${enc(slug)}`;

  // Run a request, unwrap the envelope's `data`, and raise a typed error on any
  // non-2xx. The lone `as T` is the wire→typed boundary: the row shape is the
  // `InferDoc` type the public surface maps each method to, validated server-side.
  const send = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetchImpl(url, init);
    const body = (await res.json()) as Envelope;
    if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL);
    return body.data as T;
  };

  // A GET whose `NOT_FOUND` is a `null` result (missing/soft-deleted), not an
  // error — but other 404s (unknown field/collection) still throw.
  const sendMaybe = async <T>(url: string): Promise<T | null> => {
    const res = await fetchImpl(url);
    const body = (await res.json()) as Envelope;
    if (res.ok) return body.data as T;
    if (res.status === 404 && body.error?.code === "NOT_FOUND") return null;
    throw new ContentClientError(res.status, body.error ?? INTERNAL);
  };

  const impl: CollectionClient<unknown> = {
    async list(params) {
      const res = await fetchImpl(`${root}${listQuery(params)}`);
      const body = (await res.json()) as Envelope;
      if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL);
      return {
        data: (body.data as ReadonlyArray<Stored<unknown>>) ?? [],
        nextCursor: body.nextCursor ?? null,
      };
    },
    find: (id) => sendMaybe<Stored<unknown>>(`${root}/${enc(id)}`),
    findBy: (field, value) =>
      sendMaybe<Stored<unknown>>(`${root}/by/${enc(field)}/${enc(String(value))}`),
    create: (data) => send<Stored<unknown>>(root, { method: "POST", ...jsonBody(data) }),
    update: (id, data) =>
      send<Stored<unknown>>(`${root}/${enc(id)}`, { method: "PATCH", ...jsonBody(data) }),
    async delete(id) {
      await send<unknown>(`${root}/${enc(id)}`, { method: "DELETE" });
    },
    restore: (id) => send<Stored<unknown>>(`${root}/${enc(id)}/restore`, { method: "POST" }),
    publish: (id, opts) =>
      send<Stored<unknown>>(`${root}/${enc(id)}/publish`, {
        method: "POST",
        ...(opts?.at !== undefined
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ at: opts.at }),
            }
          : {}),
      }),
    unpublish: (id) => send<Stored<unknown>>(`${root}/${enc(id)}/unpublish`, { method: "POST" }),
  };
  return impl;
}

/**
 * Build a typed REST client from a config. Iterates the config's collections to
 * materialize an accessor per slug; the public type is the `ContentClient<C>`
 * mapped type, so `client.<slug>.<method>(...)` is fully typed from the fields.
 *
 * @example
 * const client = makeClient(config, { baseUrl: "/admin/api" });
 * const post = await client.posts.create({ title: "Hi", slug: "hi" });
 * const page = await client.posts.list({ orderBy: "title", order: "asc" });
 */
export function makeClient<C extends NormalizedConfig>(
  config: C,
  options: ClientOptions,
): ContentClient<C> {
  const base = trimBase(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const client: Record<string, CollectionClient<unknown>> = {};
  for (const slug of Object.keys(config.collections)) {
    client[slug] = makeCollectionClient(slug, base, fetchImpl);
  }
  // The per-slug `CollectionClient<unknown>` accessors are re-viewed as their
  // config-derived `CollectionClient<InferDoc<…>>` types here — the single
  // construction-boundary cast that lets the runtime loop stay untyped.
  return client as unknown as ContentClient<C>;
}
