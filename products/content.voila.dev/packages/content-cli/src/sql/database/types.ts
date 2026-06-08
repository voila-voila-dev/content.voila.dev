// The `Database` service — the single read/write interface the resolver layer
// (`@voila/content`) calls. Reads (`list`/`get`/`findOne`) and writes
// (`create`/`update`/`softDelete`/`hardDelete`/`restore`) both speak the canonical
// camelCase `Document` shape; the layer maps to/from storage columns per dialect.

import { Context, Data, type Effect } from "effect";

export type OrderDirection = "asc" | "desc";

/** A decoded document: camelCase field names, JSON columns parsed. */
export type Document = Record<string, unknown>;

export interface ListOpts {
  /** Page size. Clamped to 1–100; defaults to 20. */
  readonly limit?: number;
  /** Opaque keyset cursor returned as `nextCursor` from a prior page. */
  readonly cursor?: string;
  /** Field name to order by (camelCase). Defaults to `id` (ULID = insert order). */
  readonly orderBy?: string;
  /** Sort direction. Defaults to `desc` (newest first). */
  readonly direction?: OrderDirection;
}

export interface ListResult {
  readonly documents: ReadonlyArray<Document>;
  /** Cursor for the next page, or `null` when the last page was returned. */
  readonly nextCursor: string | null;
}

/** A query or mapping failure. Wraps the underlying `SqlError` as `cause`.
 *  `conflict` is set when the failure is a unique-constraint violation (so the
 *  write core can map it to a typed `ConflictError`). `field` carries the offending
 *  column's field name when the driver reveals it. */
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly conflict?: boolean;
  readonly field?: string;
}> {}

/** A primitive value usable as a `findOne` lookup key. */
export type FieldValue = string | number | boolean;

export interface DatabaseService {
  /** Page through a collection's live (non-soft-deleted) rows via keyset pagination. */
  readonly list: (collection: string, opts?: ListOpts) => Effect.Effect<ListResult, DatabaseError>;
  /** Fetch one live row by id, or `null` if it's missing or soft-deleted. */
  readonly get: (collection: string, id: string) => Effect.Effect<Document | null, DatabaseError>;
  /** Fetch the first live row whose `field` equals `value`, or `null` if none match. */
  readonly findOne: (
    collection: string,
    field: string,
    value: FieldValue,
  ) => Effect.Effect<Document | null, DatabaseError>;
  /** Insert a row from canonical field `values` (system columns filled here); returns
   *  the stored row. A unique violation fails with `DatabaseError { conflict: true }`. */
  readonly create: (collection: string, values: Document) => Effect.Effect<Document, DatabaseError>;
  /** Patch a live row's supplied `values` (bumps `updatedAt`); returns the stored row,
   *  or `null` if it's missing or soft-deleted. Unique violation → `conflict`. */
  readonly update: (
    collection: string,
    id: string,
    values: Document,
  ) => Effect.Effect<Document | null, DatabaseError>;
  /** Soft-delete a live row (stamps `deletedAt`); `false` if it was already gone. */
  readonly softDelete: (collection: string, id: string) => Effect.Effect<boolean, DatabaseError>;
  /** Permanently remove a row regardless of soft-delete state; `false` if absent. */
  readonly hardDelete: (collection: string, id: string) => Effect.Effect<boolean, DatabaseError>;
  /** Clear `deletedAt` on a soft-deleted row; returns the restored row, or `null`
   *  if it's missing or already live. */
  readonly restore: (
    collection: string,
    id: string,
  ) => Effect.Effect<Document | null, DatabaseError>;
}

export class Database extends Context.Tag("@voila/content/Database")<Database, DatabaseService>() {}
