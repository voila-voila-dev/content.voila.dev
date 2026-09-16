// The host-provided data seam behind an *external* collection — one declared
// in the config with `external: true`, so it has no table in the content
// database. `makeDatabase(config, driver, { sources })` binds one source per
// external slug and routes that slug's `Database` calls to it; every other
// slug keeps hitting SQL. The source speaks the same canonical camelCase
// `Document` shape the SQL path does, so the REST layer, the typed client and
// the admin list views need no special case.
//
// Only `list` and `get` are mandatory: a read-only mirror of a third-party
// system is the common case. Each optional method is "unsupported" when
// absent — `Database` then rejects with `DatabaseError { unsupported: true }`,
// which the REST layer renders as `405 NOT_SUPPORTED`.

import type { Document, FieldValue, ListOpts, ListResult, SearchOpts, SearchResult } from "./types";

export interface CollectionSource {
  /**
   * Page through the collection. `opts` arrives normalized: `limit` clamped to
   * 1–100, `orderBy` (default `id`) and `direction` (default `desc`) always
   * set, and `orderBy`/`filters` already validated against the collection's
   * declared fields (plus `id`/`createdAt`/`updatedAt`). `nextCursor` is
   * opaque to the framework — the source mints and decodes its own.
   */
  list(opts: ListOpts): Promise<ListResult>;
  /** One document by id, or `null` when it doesn't exist. */
  get(id: string): Promise<Document | null>;
  /** First document whose `field` equals `value`; absent → unsupported. */
  findOne?(field: string, value: FieldValue): Promise<Document | null>;
  /** Insert from canonical field values; returns the stored document (with its `id`). */
  create?(values: Document): Promise<Document>;
  /** Patch a document; returns the stored document, or `null` when it doesn't exist. */
  update?(id: string, values: Document): Promise<Document | null>;
  /** Remove a document (both `softDelete` and `hardDelete` land here); `false` if absent. */
  delete?(id: string): Promise<boolean>;
  /** Full-text search, most-relevant-first; absent → unsupported. */
  search?(query: string, opts: SearchOpts): Promise<SearchResult>;
}

/** Options accepted by `makeDatabase(config, driver, options)`. */
export interface MakeDatabaseOptions {
  /**
   * One `CollectionSource` per external collection, keyed by slug. A key that
   * isn't an external collection of the config is a configuration error
   * (thrown at construction); an external collection with no entry rejects
   * every call with a `DatabaseError` naming the missing registration.
   */
  readonly sources?: Readonly<Record<string, CollectionSource>>;
}
