// The read path's query+decode core, shared by every transport. Both the
// `@effect/rpc` handlers (`./handlers`) and the parallel REST `HttpApi`
// (`./httpapi`) delegate here, so list/find/findOne semantics — pagination,
// the typed-error mapping, and decoding rows through the per-collection document
// schema — live in exactly one place. The procedures stay transport-agnostic:
// each returns an `Effect` over `Database`, failing with the typed read errors.

import { Effect, Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import { Database, type DatabaseError, type Document, type FieldValue } from "../sql/database";
import { buildDocumentSchemas } from "./document";
import { BadRequest, InternalError, NotFound } from "./errors";

/** A `DatabaseError` with no `cause` is a validation/bad-input failure
 *  (`BadRequest`); a wrapped `SqlError` is infrastructure (`InternalError`). */
const mapDbError = (error: DatabaseError) =>
  error.cause === undefined
    ? new BadRequest({ message: error.message })
    : new InternalError({ message: error.message });

/** `list` pagination knobs (mirrors `ListPayload`'s decoded shape). */
export interface ListArgs {
  readonly limit?: number;
  readonly cursor?: string;
  readonly orderBy?: string;
  readonly direction?: "asc" | "desc";
}

/** A decoded list page: documents are the decoded `Type`, ready to re-encode. */
export interface ListPage {
  readonly documents: ReadonlyArray<unknown>;
  readonly nextCursor: string | null;
}

/** The transport-agnostic read operations for a config's collections. */
export interface ReadCore {
  readonly list: (
    slug: string,
    args: ListArgs,
  ) => Effect.Effect<ListPage, BadRequest | InternalError, Database>;
  readonly find: (
    slug: string,
    id: string,
  ) => Effect.Effect<unknown, NotFound | BadRequest | InternalError, Database>;
  readonly findOne: (
    slug: string,
    field: string,
    value: FieldValue,
  ) => Effect.Effect<unknown | null, BadRequest | InternalError, Database>;
}

/**
 * Build the read core for a config. The per-collection document schemas are
 * computed once; each operation queries `Database`, maps `DatabaseError` to a
 * typed read error, and decodes the raw row(s) so the result is the validated
 * document `Type` (a stored row that fails to decode is an `InternalError` —
 * the data, not the request, is at fault).
 */
export const makeReadCore = (config: NormalizedConfig): ReadCore => {
  const documents = buildDocumentSchemas(config);

  const decode = (slug: string, row: Document) =>
    Schema.decodeUnknown(documents.get(slug) as Schema.Schema<unknown>)(row).pipe(
      Effect.mapError(() => new InternalError({ message: `Failed to decode "${slug}" document.` })),
    );

  return {
    list: (slug, args) =>
      Effect.flatMap(Database, (db) => db.list(slug, args)).pipe(
        Effect.mapError(mapDbError),
        Effect.flatMap((result) =>
          Effect.forEach(result.documents, (row) => decode(slug, row)).pipe(
            Effect.map((docs) => ({ documents: docs, nextCursor: result.nextCursor })),
          ),
        ),
      ),

    find: (slug, id) =>
      Effect.flatMap(Database, (db) => db.get(slug, id)).pipe(
        Effect.mapError(mapDbError),
        Effect.flatMap(
          (doc): Effect.Effect<unknown, NotFound | InternalError> =>
            doc === null ? Effect.fail(new NotFound({ collection: slug, id })) : decode(slug, doc),
        ),
      ),

    findOne: (slug, field, value) =>
      Effect.flatMap(Database, (db) => db.findOne(slug, field, value)).pipe(
        Effect.mapError(mapDbError),
        Effect.flatMap((doc) => (doc === null ? Effect.succeed(null) : decode(slug, doc))),
      ),
  };
};
