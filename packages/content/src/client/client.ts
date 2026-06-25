// The typed REST client, inferred straight from a config — no codegen. Given
// `defineConfig(...)`, `makeClient(config, ...)` returns an object with one
// accessor per collection (`client.posts.list()`, `client.posts.create(...)`,
// …), each method's argument and result types resolved from the collection's
// fields via `InferDoc`. At runtime every method is a thin `fetch` over the REST
// routes the `createRestHandler` dispatcher serves; the wire envelope is unwrapped
// to typed data, and any error envelope becomes a typed `ContentClientError`.

import type { NormalizedConfig } from "../config/config";
import type { I18nConfig } from "../config/i18n";
import type {
  InferDoc,
  InferDrafts,
  InferLocalizedDoc,
  InferLocalizedSingleton,
  InferSingleton,
} from "../config/schema/infer";
import { type ApiFailure, ContentClientError } from "./errors";

// `type` aliases rather than `interface`s on purpose: an object-literal type
// alias carries an implicit index signature into an intersection, so a typed
// `Stored<…>` stays assignable to the admin UI's loose `Record<string, unknown>`
// document shape. An `interface` member would suppress that and break the
// hand-off from the typed client to `@voila/content-ui`.

/** System columns the server stamps on every row, on top of the declared fields. */
export type SystemFields = {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt: number | null;
};

/**
 * Draft-workflow columns, present only on collections defined with
 * `drafts: true`. A `published` row whose `publishedAt` is still in the future
 * is scheduled, not yet live.
 */
export type DraftSystemFields = {
  readonly status: "draft" | "published";
  readonly publishedAt: number | null;
};

/**
 * A stored document: the declared field shape plus the system columns. When the
 * collection is draft-enabled (`Drafts` is `true` — inferred from the config by
 * `ContentClient`), the draft columns are part of the row type too.
 */
export type Stored<Doc, Drafts extends boolean = false> = Doc &
  SystemFields &
  (Drafts extends true ? DraftSystemFields : unknown);

/** A primitive usable as a unique-field lookup value. */
export type LookupValue = string | number | boolean;

/** Orderable keys: a declared field or one of the always-present system columns. */
export type OrderKey<Doc> = (keyof Doc & string) | "id" | "createdAt" | "updatedAt";

/**
 * Draft scoping for `list` (draft-enabled collections only): live `published`
 * rows (the default), `draft` rows, `scheduled` rows (published with a future
 * `publishedAt`), or `any` row regardless of status.
 */
export type DraftFilter = "published" | "draft" | "scheduled" | "any";

/** Comparison a list filter applies; `contains` is a substring match (text). */
export type FilterOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";

/**
 * One server-side field predicate (`?filter=field:op:value`). The default `Doc`
 * is loose (any string field) so the untyped `ViewConfig.filters` can name any
 * column; `ListParams<Doc>` passes a concrete `Doc` to constrain `field` to that
 * collection's keys.
 */
export interface ListFilter<Doc = Record<string, unknown>> {
  readonly field: (keyof Doc & string) | "id" | "createdAt" | "updatedAt";
  readonly op: FilterOp;
  readonly value: LookupValue;
}

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
  /** Server-side field predicates, AND-ed into the scope. */
  readonly filters?: ReadonlyArray<ListFilter<Doc>>;
  /** Also fetch the total row count for the same scope (`total` on the page). */
  readonly count?: boolean;
}

/** The shape a saved view renders as. */
export type ViewType = "table" | "kanban" | "map";

/** A saved view's sort choice (maps to the list `orderBy`/`order`). */
export interface ViewSort {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

/** The JSON payload a saved view stores (columns, sort, filters, shape fields). */
export interface ViewConfig {
  readonly columns?: ReadonlyArray<string>;
  readonly sort?: ViewSort;
  readonly filters?: ReadonlyArray<ListFilter>;
  /** The enum/select/status field a kanban view groups columns by. */
  readonly kanbanField?: string;
  /** The geo field a map view plots. */
  readonly geoField?: string;
}

/** A saved admin list view, scoped to its owner. */
export interface SavedView {
  readonly id: string;
  readonly collection: string;
  readonly ownerId: string;
  readonly name: string;
  readonly type: ViewType;
  readonly config: ViewConfig;
  readonly isDefault: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Fields supplied to create a saved view (owner + collection come from context). */
export interface NewView {
  readonly name: string;
  readonly type: ViewType;
  readonly config: ViewConfig;
  readonly isDefault?: boolean;
}

/** A partial update to a saved view. */
export interface ViewPatch {
  readonly name?: string;
  readonly type?: ViewType;
  readonly config?: ViewConfig;
  readonly isDefault?: boolean;
}

/** The per-collection saved-views sub-API (owner-scoped server-side). */
export interface ViewsClient {
  /** The signed-in user's saved views for this collection. */
  list(): Promise<ReadonlyArray<SavedView>>;
  /** Save a new view; returns the stored row. */
  create(view: NewView): Promise<SavedView>;
  /** Update one of the user's views; returns the stored row. */
  update(id: string, patch: ViewPatch): Promise<SavedView>;
  /** Delete one of the user's views. */
  delete(id: string): Promise<void>;
}

export interface ListPage<Doc, Drafts extends boolean = false> {
  readonly data: ReadonlyArray<Stored<Doc, Drafts>>;
  readonly nextCursor: string | null;
  /** Total rows in scope (all pages); present only when `count` was requested. */
  readonly total?: number;
}

/**
 * One snapshot in a document's version history (revisions-enabled collections):
 * the full stored row as it stood after the write that produced it. `rev`
 * counts from 1 per document; newest is highest.
 */
export interface Revision<Doc, Drafts extends boolean = false> {
  readonly rev: number;
  /** Epoch-ms time the snapshot was taken. */
  readonly createdAt: number;
  readonly doc: Stored<Doc, Drafts>;
}

export interface RevisionListParams {
  /** Page size (server clamps to 1–100). */
  readonly limit?: number;
  /** Opaque `nextCursor` from a prior page. */
  readonly cursor?: string;
}

export interface RevisionPage<Doc, Drafts extends boolean = false> {
  /** Revisions ordered newest-first. */
  readonly data: ReadonlyArray<Revision<Doc, Drafts>>;
  readonly nextCursor: string | null;
}

export interface SearchParams {
  /** Max results (server clamps to 1–100; defaults to 20). */
  readonly limit?: number;
  /** Draft scoping; defaults to live published rows. Ignored for non-draft collections. */
  readonly status?: DraftFilter;
}

export interface SearchPage<Doc, Drafts extends boolean = false> {
  /** Matched rows, ordered most-relevant-first. */
  readonly data: ReadonlyArray<Stored<Doc, Drafts>>;
}

/** A read scoped to one locale — localized fields flatten to that locale's value. */
export interface LocaleOption<L extends string = string> {
  readonly locale: L;
}

/**
 * The per-collection method surface, typed from the collection's document shape.
 * `Drafts` mirrors the collection's `drafts` flag: when `true`, every returned
 * row carries the `status`/`publishedAt` draft columns. `LDoc` is the
 * locale-flattened row shape (`InferLocalizedDoc`) a `{ locale }` read returns;
 * `L` is the union of the config's locales, so a typo in a `locale` argument
 * fails to compile.
 */
export interface CollectionClient<
  Doc,
  Drafts extends boolean = false,
  LDoc = Doc,
  L extends string = string,
> {
  /** Page through live rows for one locale — localized fields flattened. */
  list(params: ListParams<Doc> & LocaleOption<L>): Promise<ListPage<LDoc, Drafts>>;
  /** Page through live rows (keyset pagination). */
  list(params?: ListParams<Doc>): Promise<ListPage<Doc, Drafts>>;
  /** Fetch one row by id for one locale, or `null` if missing/soft-deleted. */
  find(id: string, opts: LocaleOption<L>): Promise<Stored<LDoc, Drafts> | null>;
  /** Fetch one row by id, or `null` if it's missing or soft-deleted. */
  find(id: string): Promise<Stored<Doc, Drafts> | null>;
  /** Fetch the row matching a unique field for one locale, or `null` if none match. */
  findBy(
    field: keyof Doc & string,
    value: LookupValue,
    opts: LocaleOption<L>,
  ): Promise<Stored<LDoc, Drafts> | null>;
  /** Fetch the row matching a unique field, or `null` if none match. */
  findBy(field: keyof Doc & string, value: LookupValue): Promise<Stored<Doc, Drafts> | null>;
  /** Create a row from a full field payload; returns the stored row. */
  create(data: Doc): Promise<Stored<Doc, Drafts>>;
  /** Patch a subset of a row's fields; returns the stored row. */
  update(id: string, data: Partial<Doc>): Promise<Stored<Doc, Drafts>>;
  /** Soft-delete a row. */
  delete(id: string): Promise<void>;
  /** Restore a soft-deleted row; returns the restored row. */
  restore(id: string): Promise<Stored<Doc, Drafts>>;
  /** Publish a row (draft-enabled collections); `at` schedules a future go-live. */
  publish(id: string, opts?: { at?: number }): Promise<Stored<Doc, Drafts>>;
  /** Return a row to draft (draft-enabled collections). */
  unpublish(id: string): Promise<Stored<Doc, Drafts>>;
  /** Page through a row's version history, newest first (revisions-enabled collections). */
  revisions(id: string, params?: RevisionListParams): Promise<RevisionPage<Doc, Drafts>>;
  /** Fetch one revision by number, or `null` if it doesn't exist (revisions-enabled
   *  collections). */
  revision(id: string, rev: number): Promise<Revision<Doc, Drafts> | null>;
  /** Re-apply a past revision's content fields (appends a new revision — history
   *  stays linear); returns the stored row (revisions-enabled collections). */
  restoreRevision(id: string, rev: number): Promise<Stored<Doc, Drafts>>;
  /** Full-text search the collection for one locale — localized fields flattened
   *  (search-enabled collections). */
  search(query: string, params: SearchParams & LocaleOption<L>): Promise<SearchPage<LDoc, Drafts>>;
  /** Full-text search the collection, ranked by relevance (search-enabled collections). */
  search(query: string, params?: SearchParams): Promise<SearchPage<Doc, Drafts>>;
  /** Manage the signed-in user's saved list views for this collection. */
  readonly views: ViewsClient;
}

/**
 * The per-singleton method surface: the one document is fetched with `get`
 * (`null` until the first write) and created-or-replaced with `set` (a full
 * field payload — the server upserts the row pinned to `id = slug`).
 */
export interface SingletonClient<Doc, LDoc = Doc, L extends string = string> {
  /** Fetch the document for one locale, or `null` if it hasn't been set yet. */
  get(opts: LocaleOption<L>): Promise<Stored<LDoc> | null>;
  /** Fetch the document, or `null` if it hasn't been set yet. */
  get(): Promise<Stored<Doc> | null>;
  /** Create-or-replace the document from a full field payload; returns the stored row. */
  set(data: Doc): Promise<Stored<Doc>>;
}

// The union of a config's selected locales — what a `locale` read argument
// accepts. A config without `i18n` keeps the wide `Locale` union (the server
// rejects the parameter at runtime with a 400).
type ConfigLocale<C extends NormalizedConfig> =
  NonNullable<C["i18n"]> extends I18nConfig<infer Locales> ? Locales[number] : string;

/** The typed client surface: one `CollectionClient` per configured collection,
 *  plus one `SingletonClient` per configured singleton. */
export type ContentClient<C extends NormalizedConfig> = {
  readonly [Slug in keyof C["collections"] & string]: CollectionClient<
    InferDoc<C, Slug>,
    InferDrafts<C, Slug>,
    InferLocalizedDoc<C, Slug>,
    ConfigLocale<C>
  >;
} & {
  readonly [Slug in keyof C["singletons"] & string]: SingletonClient<
    InferSingleton<C, Slug>,
    InferLocalizedSingleton<C, Slug>,
    ConfigLocale<C>
  >;
};

/**
 * The slice of `fetch` the client actually uses — its call signature only.
 * Deriving it from `typeof fetch` keeps the arg/return types exact while
 * dropping the static extras (Bun/undici add a `preconnect` method) a custom
 * wrapper has no reason to implement. A plain `async (input, init) => …` is a
 * valid `Fetch`; the global `fetch` is too.
 */
export type Fetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

export interface ClientOptions {
  /**
   * Base the REST routes mount under (e.g. `/admin/api`). Root-relative works in
   * the browser; tests and server-to-server callers pass an absolute URL.
   */
  readonly baseUrl: string;
  /** Fetch implementation; defaults to the global `fetch`. */
  readonly fetch?: Fetch;
}

/** The on-the-wire envelope every endpoint returns (success or error). */
interface Envelope {
  readonly data?: unknown;
  readonly nextCursor?: string | null;
  readonly total?: number;
  readonly error?: ApiFailure;
  /** The server's human-readable summary of `error` (see `failureMessage`). */
  readonly message?: string;
}

// Fallback when a non-2xx response has no parseable error body — the call still
// failed, so surface a generic INTERNAL rather than a misleading success.
const INTERNAL: ApiFailure = { code: "INTERNAL" };

const enc = encodeURIComponent;

/** Reserved sub-segment for the saved-views routes (`/:collection/_views`). */
const VIEWS_PATH = "_views";

function trimBase(base: string): string {
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function listQuery<Doc>(params: (ListParams<Doc> & { locale?: string }) | undefined): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.orderBy !== undefined) qs.set("orderBy", params.orderBy);
  if (params.order !== undefined) qs.set("order", params.order);
  if (params.cursor !== undefined) qs.set("cursor", params.cursor);
  if (params.status !== undefined) qs.set("status", params.status);
  // Filters are repeatable: `filter=field:op:value`.
  for (const filter of params.filters ?? []) {
    qs.append("filter", `${filter.field}:${filter.op}:${String(filter.value)}`);
  }
  if (params.count !== undefined) qs.set("count", params.count ? "1" : "0");
  if (params.locale !== undefined) qs.set("locale", params.locale);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

// `?locale=` suffix for the single-row reads.
function localeQuery(opts: { locale?: string } | undefined): string {
  return opts?.locale === undefined ? "" : `?locale=${enc(opts.locale)}`;
}

function jsonBody(data: unknown): RequestInit {
  return { headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) };
}

// The two request shapes every accessor builds on, closed over a fetch impl.
function makeSenders(fetchImpl: Fetch) {
  // Run a request, unwrap the envelope's `data`, and raise a typed error on any
  // non-2xx. The lone `as T` is the wire→typed boundary: the row shape is the
  // `InferDoc` type the public surface maps each method to, validated server-side.
  const send = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetchImpl(url, init);
    const body = (await res.json()) as Envelope;
    if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
    return body.data as T;
  };

  // A GET whose `NOT_FOUND` is a `null` result (missing/soft-deleted), not an
  // error — but other 404s (unknown field/collection) still throw.
  const sendMaybe = async <T>(url: string): Promise<T | null> => {
    const res = await fetchImpl(url);
    const body = (await res.json()) as Envelope;
    if (res.ok) return body.data as T;
    if (res.status === 404 && body.error?.code === "NOT_FOUND") return null;
    throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
  };

  return { send, sendMaybe };
}

function makeCollectionClient(
  slug: string,
  base: string,
  fetchImpl: Fetch,
): CollectionClient<unknown> {
  const root = `${base}/${enc(slug)}`;
  const { send, sendMaybe } = makeSenders(fetchImpl);

  const impl: CollectionClient<unknown> = {
    async list(params?: ListParams<unknown> & { locale?: string }) {
      const res = await fetchImpl(`${root}${listQuery(params)}`);
      const body = (await res.json()) as Envelope;
      if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
      return {
        data: (body.data as ReadonlyArray<Stored<unknown>>) ?? [],
        nextCursor: body.nextCursor ?? null,
        ...(body.total !== undefined ? { total: body.total } : {}),
      };
    },
    find: (id, opts?: { locale?: string }) =>
      sendMaybe<Stored<unknown>>(`${root}/${enc(id)}${localeQuery(opts)}`),
    findBy: (field, value, opts?: { locale?: string }) =>
      sendMaybe<Stored<unknown>>(
        `${root}/by/${enc(field)}/${enc(String(value))}${localeQuery(opts)}`,
      ),
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
    async revisions(id, params) {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.cursor !== undefined) qs.set("cursor", params.cursor);
      const query = qs.toString();
      const res = await fetchImpl(`${root}/${enc(id)}/revisions${query ? `?${query}` : ""}`);
      const body = (await res.json()) as Envelope;
      if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
      return {
        data: (body.data as ReadonlyArray<Revision<unknown>>) ?? [],
        nextCursor: body.nextCursor ?? null,
      };
    },
    revision: (id, rev) => sendMaybe<Revision<unknown>>(`${root}/${enc(id)}/revisions/${rev}`),
    restoreRevision: (id, rev) =>
      send<Stored<unknown>>(`${root}/${enc(id)}/revisions/${rev}/restore`, { method: "POST" }),
    async search(query, params?: SearchParams & { locale?: string }) {
      const qs = new URLSearchParams({ q: query });
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.status !== undefined) qs.set("status", params.status);
      if (params?.locale !== undefined) qs.set("locale", params.locale);
      const res = await fetchImpl(`${root}/search?${qs.toString()}`);
      const body = (await res.json()) as Envelope;
      if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
      return { data: (body.data as ReadonlyArray<Stored<unknown>>) ?? [] };
    },
    views: {
      list: () => send<ReadonlyArray<SavedView>>(`${root}/${VIEWS_PATH}`),
      create: (view) =>
        send<SavedView>(`${root}/${VIEWS_PATH}`, { method: "POST", ...jsonBody(view) }),
      update: (id, patch) =>
        send<SavedView>(`${root}/${VIEWS_PATH}/${enc(id)}`, {
          method: "PATCH",
          ...jsonBody(patch),
        }),
      async delete(id) {
        await send<unknown>(`${root}/${VIEWS_PATH}/${enc(id)}`, { method: "DELETE" });
      },
    },
  };
  return impl;
}

function makeSingletonClient(
  slug: string,
  base: string,
  fetchImpl: Fetch,
): SingletonClient<unknown> {
  const root = `${base}/${enc(slug)}`;
  const { send, sendMaybe } = makeSenders(fetchImpl);
  return {
    // 404 NOT_FOUND just means the document hasn't been set yet → `null`.
    get: (opts?: { locale?: string }) => sendMaybe<Stored<unknown>>(`${root}${localeQuery(opts)}`),
    set: (data) => send<Stored<unknown>>(root, { method: "PUT", ...jsonBody(data) }),
  };
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
  const client: Record<string, CollectionClient<unknown> | SingletonClient<unknown>> = {};
  for (const slug of Object.keys(config.collections)) {
    client[slug] = makeCollectionClient(slug, base, fetchImpl);
  }
  for (const slug of Object.keys(config.singletons)) {
    client[slug] = makeSingletonClient(slug, base, fetchImpl);
  }
  // The per-slug `CollectionClient<unknown>` accessors are re-viewed as their
  // config-derived `CollectionClient<InferDoc<…>>` types here — the single
  // construction-boundary cast that lets the runtime loop stay untyped.
  return client as unknown as ContentClient<C>;
}
