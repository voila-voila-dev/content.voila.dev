// The `Database` service — the single read/query interface the resolver layer
// (`@voila/content`) calls. M1 ships the read path (`list` + `get`); write
// primitives (insert/update/softDelete/restore) land in M2.

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

/** A query or mapping failure. Wraps the underlying `SqlError` as `cause`. */
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly cause?: unknown;
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
}

export class Database extends Context.Tag("@voila/content/Database")<Database, DatabaseService>() {}
