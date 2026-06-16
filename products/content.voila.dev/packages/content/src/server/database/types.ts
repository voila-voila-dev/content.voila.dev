// The `Database` service — the single read/write interface the resolver/REST
// layer calls. Reads (`list`/`get`/`findOne`) and writes
// (`create`/`update`/`softDelete`/`hardDelete`/`restore`) both speak the
// canonical camelCase `Document` shape; the implementation maps to/from storage
// columns per dialect. Every method returns a `Promise` and rejects with a
// `DatabaseError` (see `./database`) on failure.

export type OrderDirection = "asc" | "desc";

/**
 * Draft scoping for `list` on a draft-enabled collection (ignored otherwise):
 * - `published` (default) — only live rows (`status = published` and any
 *   `publishedAt` schedule has elapsed),
 * - `draft` — only rows still in draft,
 * - `scheduled` — rows published with a `publishedAt` still in the future
 *   (queued to go live; they flip to `published` as query time passes it),
 * - `any` — every row regardless of status (the admin view).
 */
export type DraftFilter = "published" | "draft" | "scheduled" | "any";

/** A decoded document: camelCase field names, JSON columns parsed. */
export type Document = Record<string, unknown>;

export interface ListOpts {
  /** Page size. Clamped to 1–100; defaults to 20. */
  readonly limit?: number;
  /** Opaque keyset cursor returned as `nextCursor` from a prior page. */
  readonly cursor?: string;
  /** Field name to order by (camelCase). Defaults to `id` (insert order). */
  readonly orderBy?: string;
  /** Sort direction. Defaults to `desc` (newest first). */
  readonly direction?: OrderDirection;
  /** Draft scoping (draft-enabled collections only). Defaults to `published`. */
  readonly status?: DraftFilter;
  /** Also compute the total row count for the same scope (one extra `COUNT(*)`,
   *  cursor-independent). Off by default — most pages don't need it. */
  readonly count?: boolean;
}

export interface ListResult {
  readonly documents: ReadonlyArray<Document>;
  /** Cursor for the next page, or `null` when the last page was returned. */
  readonly nextCursor: string | null;
  /** Total rows in scope (all pages); present only when `count` was requested. */
  readonly total?: number;
}

/** A primitive value usable as a `findOne` lookup key. */
export type FieldValue = string | number | boolean;

export interface Database {
  /** Page through a collection's live (non-soft-deleted) rows via keyset pagination. */
  list(collection: string, opts?: ListOpts): Promise<ListResult>;
  /** Fetch one live row by id, or `null` if it's missing or soft-deleted. */
  get(collection: string, id: string): Promise<Document | null>;
  /** Fetch the first live row whose `field` equals `value`, or `null` if none match. */
  findOne(collection: string, field: string, value: FieldValue): Promise<Document | null>;
  /** Insert a row from canonical field `values` (system columns filled here); returns
   *  the stored row. A unique violation rejects with `DatabaseError { conflict: true }`. */
  create(collection: string, values: Document): Promise<Document>;
  /** Patch a live row's supplied `values` (bumps `updatedAt`); returns the stored row,
   *  or `null` if it's missing or soft-deleted. Unique violation → `conflict`. */
  update(collection: string, id: string, values: Document): Promise<Document | null>;
  /** Create-or-update the one row of a singleton (`id` = the singleton's slug,
   *  pinned by the table's CHECK constraint); a soft-deleted row revives. Returns
   *  the stored row. Errors if the collection isn't a singleton. */
  upsert(collection: string, values: Document): Promise<Document>;
  /** Soft-delete a live row (stamps `deletedAt`); `false` if it was already gone. */
  softDelete(collection: string, id: string): Promise<boolean>;
  /** Permanently remove a row regardless of soft-delete state; `false` if absent. */
  hardDelete(collection: string, id: string): Promise<boolean>;
  /** Clear `deletedAt` on a soft-deleted row; returns the restored row, or `null`
   *  if it's missing or already live. */
  restore(collection: string, id: string): Promise<Document | null>;
  /** Publish a live row: set `status` to `published` and stamp `publishedAt`
   *  (`opts.at` to schedule a future go-live; defaults to now). Returns the
   *  stored row, or `null` if missing/soft-deleted. Errors if the collection
   *  isn't draft-enabled. */
  publish(collection: string, id: string, opts?: PublishOpts): Promise<Document | null>;
  /** Return a row to `draft` and clear `publishedAt`; returns the stored row, or
   *  `null` if missing/soft-deleted. Errors if the collection isn't draft-enabled. */
  unpublish(collection: string, id: string): Promise<Document | null>;
  /** Page through a document's version history, newest first. Errors if the
   *  collection isn't revisions-enabled. */
  listRevisions(
    collection: string,
    id: string,
    opts?: RevisionListOpts,
  ): Promise<RevisionListResult>;
  /** Fetch one revision by number, or `null` if it doesn't exist. Errors if the
   *  collection isn't revisions-enabled. */
  getRevision(collection: string, id: string, rev: number): Promise<Revision | null>;
  /** Re-apply a past revision's content fields to the live row (via `update`, so
   *  a new revision is appended — history stays linear). Publish state and other
   *  system columns are untouched. Returns the stored row, or `null` if the
   *  revision or the live row is missing. Errors if the collection isn't
   *  revisions-enabled. */
  restoreRevision(collection: string, id: string, rev: number): Promise<Document | null>;
  /** Full-text search a collection's live rows, ranked by relevance (bm25).
   *  Results pass through the normal read scoping (soft-delete + `opts.status`
   *  draft scoping). Returns rows newest-relevance-first. Errors if the
   *  collection isn't search-enabled. */
  search(collection: string, query: string, opts?: SearchOpts): Promise<SearchResult>;
}

export interface SearchOpts {
  /** Max results. Clamped to 1–100; defaults to 20. */
  readonly limit?: number;
  /** Draft scoping for the matched rows (draft-enabled collections only).
   *  Defaults to `published` — only live rows are searchable by default. */
  readonly status?: DraftFilter;
}

export interface SearchResult {
  /** Matched rows, ordered most-relevant-first. */
  readonly documents: ReadonlyArray<Document>;
}

export interface PublishOpts {
  /** Epoch-ms go-live time. A future value schedules publication. Defaults to now. */
  readonly at?: number;
}

/**
 * One snapshot in a document's version history: the full stored row (system
 * columns included) as it stood after the write that produced it. `rev` counts
 * from 1 per document and only ever grows — restoring an old revision appends
 * a new one rather than rewinding, so history stays linear.
 */
export interface Revision {
  /** 1-based, per-document revision number; newest is highest. */
  readonly rev: number;
  /** Epoch-ms time the snapshot was taken. */
  readonly createdAt: number;
  /** The stored row at that point, in canonical camelCase form. */
  readonly doc: Document;
}

export interface RevisionListOpts {
  /** Page size. Clamped to 1–100; defaults to 20. */
  readonly limit?: number;
  /** Cursor returned as `nextCursor` from a prior page. */
  readonly cursor?: string;
}

export interface RevisionListResult {
  /** Revisions ordered newest-first. */
  readonly revisions: ReadonlyArray<Revision>;
  /** Cursor for the next page, or `null` when the last page was returned. */
  readonly nextCursor: string | null;
}
