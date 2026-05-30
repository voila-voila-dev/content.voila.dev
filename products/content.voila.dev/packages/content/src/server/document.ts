// Per-collection document `Schema` — the system columns prepended to the
// collection's own field schemas (reused verbatim from `@voila/content-schema`).
// This is the single source of truth the RPC procedures encode/decode through,
// so the wire is validated against the real document shape, not a generic record.

import { Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import type { Collection } from "../config/schema/collection";

// System columns every collection row carries (see the DDL generator). The
// timestamps are stored as epoch-ms and decode to `Date` — the same encoding as
// the `datetime` field (`Schema.DateFromNumber`), so every timestamp column in a
// decoded document is a `Date`, not a mix of `Date` and `number`.
export const systemColumns = {
  id: Schema.String,
  createdAt: Schema.DateFromNumber,
  updatedAt: Schema.DateFromNumber,
  deletedAt: Schema.NullOr(Schema.DateFromNumber),
};

/** The full document schema for a collection: system columns + its fields. */
export const collectionDocumentSchema = (collection: Collection) =>
  Schema.Struct({ ...systemColumns, ...collection.fields });

/** Document schema per collection slug, for the handlers to decode rows through. */
export const buildDocumentSchemas = (
  config: NormalizedConfig,
): ReadonlyMap<string, Schema.Schema.Any> =>
  new Map(
    Object.entries(config.collections).map(
      ([slug, collection]) => [slug, collectionDocumentSchema(collection)] as const,
    ),
  );
