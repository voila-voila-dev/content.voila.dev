// The `Database` service — the single read/write interface the resolver/REST
// layer calls. Reads (`list`/`get`/`findOne`) and writes
// (`create`/`update`/`softDelete`/`hardDelete`/`restore`) both speak the
// canonical camelCase `Document` shape; the implementation maps to/from storage
// columns per dialect. Every method returns a `Promise` and rejects with a
// `DatabaseError` (see `./database`) on failure.

export type OrderDirection = "asc" | "desc";

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
}

export interface ListResult {
  readonly documents: ReadonlyArray<Document>;
  /** Cursor for the next page, or `null` when the last page was returned. */
  readonly nextCursor: string | null;
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
  /** Soft-delete a live row (stamps `deletedAt`); `false` if it was already gone. */
  softDelete(collection: string, id: string): Promise<boolean>;
  /** Permanently remove a row regardless of soft-delete state; `false` if absent. */
  hardDelete(collection: string, id: string): Promise<boolean>;
  /** Clear `deletedAt` on a soft-deleted row; returns the restored row, or `null`
   *  if it's missing or already live. */
  restore(collection: string, id: string): Promise<Document | null>;
}
