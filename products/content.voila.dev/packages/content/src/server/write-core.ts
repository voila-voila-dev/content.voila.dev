// The write path's validate+persist core, the mutation mirror of `./read-core`.
// Each operation validates the input against the per-collection field schema (a
// `ParseError` becomes a typed `ValidationError` with a `{ fields }` map — the same
// schema the client form decodes against), persists through the `Database` service,
// maps a `DatabaseError` to the typed write errors (`ConflictError`/`NotFound`/
// `InternalError`), and decodes the stored row back through the document schema. The
// procedures stay transport-agnostic: each returns an `Effect` over `Database`.

import { Effect, ParseResult, Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import { Database, type DatabaseError, type Document } from "../sql/database";
import { buildDocumentSchemas } from "./document";
import { ConflictError, InternalError, NotFound, ValidationError } from "./errors";

/** A delete acknowledgement — the id and whether it was a hard purge. */
export interface DeleteResult {
  readonly id: string;
  readonly hard: boolean;
}

/** Transport-agnostic write operations for a config's collections. */
export interface WriteCore {
  readonly create: (
    slug: string,
    data: unknown,
  ) => Effect.Effect<unknown, ValidationError | ConflictError | InternalError, Database>;
  readonly update: (
    slug: string,
    id: string,
    data: unknown,
  ) => Effect.Effect<unknown, ValidationError | ConflictError | NotFound | InternalError, Database>;
  readonly delete: (
    slug: string,
    id: string,
    hard: boolean,
  ) => Effect.Effect<DeleteResult, NotFound | InternalError, Database>;
  readonly restore: (
    slug: string,
    id: string,
  ) => Effect.Effect<unknown, NotFound | InternalError, Database>;
}

// Group a `ParseError`'s issues by their top-level field name → messages, the shape
// the `VALIDATION` envelope carries (and the form renders per field).
const toFields = (error: ParseResult.ParseError): Record<string, Array<string>> => {
  const fields: Record<string, Array<string>> = {};
  for (const issue of ParseResult.ArrayFormatter.formatErrorSync(error)) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_";
    const messages = fields[key] ?? [];
    messages.push(issue.message);
    fields[key] = messages;
  }
  return fields;
};

/**
 * Build the write core for a config. Per collection it precomputes the input schema
 * (`Schema.Struct(fields)`), its partial (for `update`), and the document schema used
 * to decode the stored row back into the typed success value.
 */
export const makeWriteCore = (config: NormalizedConfig): WriteCore => {
  const documents = buildDocumentSchemas(config);
  const inputs = new Map<string, Schema.Schema<Record<string, unknown>>>();
  const partials = new Map<string, Schema.Schema<Record<string, unknown>>>();
  for (const [slug, collection] of Object.entries(config.collections)) {
    const struct = Schema.Struct(collection.fields) as unknown as Schema.Schema<
      Record<string, unknown>
    >;
    inputs.set(slug, struct);
    partials.set(slug, Schema.partial(struct) as Schema.Schema<Record<string, unknown>>);
  }

  const decode = (slug: string, row: Document) =>
    Schema.decodeUnknown(documents.get(slug) as Schema.Schema<unknown>)(row).pipe(
      Effect.mapError(() => new InternalError({ message: `Failed to decode "${slug}" document.` })),
    );

  // Validate `data` against `schema`, then re-encode the decoded value to the
  // canonical storage form the `Database` layer expects.
  const validate = (slug: string, schema: Schema.Schema<Record<string, unknown>>, data: unknown) =>
    // `errors: "all"` so every offending field is reported, not just the first.
    Schema.decodeUnknown(schema, { errors: "all" })(data).pipe(
      Effect.mapError(
        (error) => new ValidationError({ collection: slug, fields: toFields(error) }),
      ),
      Effect.flatMap((value) =>
        Schema.encode(schema)(value).pipe(
          Effect.mapError(
            () => new InternalError({ message: `Failed to encode "${slug}" input.` }),
          ),
        ),
      ),
    );

  const mapDbError =
    (slug: string) =>
    (error: DatabaseError): ConflictError | InternalError =>
      error.conflict
        ? new ConflictError({
            collection: slug,
            field: error.field ?? null,
            message: error.message,
          })
        : new InternalError({ message: error.message });

  // Every configured slug has an entry; handlers are only built for real slugs.
  const inputFor = (slug: string) => inputs.get(slug) as Schema.Schema<Record<string, unknown>>;
  const partialFor = (slug: string) => partials.get(slug) as Schema.Schema<Record<string, unknown>>;

  return {
    create: (slug, data) =>
      validate(slug, inputFor(slug), data).pipe(
        Effect.flatMap((values) =>
          Effect.flatMap(Database, (db) => db.create(slug, values as Document)).pipe(
            Effect.mapError(mapDbError(slug)),
          ),
        ),
        Effect.flatMap((row) => decode(slug, row)),
      ),

    update: (slug, id, data) =>
      validate(slug, partialFor(slug), data).pipe(
        Effect.flatMap((values) =>
          Effect.flatMap(Database, (db) => db.update(slug, id, values as Document)).pipe(
            Effect.mapError(mapDbError(slug)),
          ),
        ),
        Effect.flatMap(
          (row): Effect.Effect<unknown, NotFound | InternalError> =>
            row === null ? Effect.fail(new NotFound({ collection: slug, id })) : decode(slug, row),
        ),
      ),

    delete: (slug, id, hard) =>
      Effect.flatMap(Database, (db) =>
        hard ? db.hardDelete(slug, id) : db.softDelete(slug, id),
      ).pipe(
        Effect.mapError((error) => new InternalError({ message: error.message })),
        Effect.flatMap((removed) =>
          removed
            ? Effect.succeed({ id, hard } satisfies DeleteResult)
            : Effect.fail(new NotFound({ collection: slug, id })),
        ),
      ),

    restore: (slug, id) =>
      Effect.flatMap(Database, (db) => db.restore(slug, id)).pipe(
        Effect.mapError((error) => new InternalError({ message: error.message })),
        Effect.flatMap(
          (row): Effect.Effect<unknown, NotFound | InternalError> =>
            row === null ? Effect.fail(new NotFound({ collection: slug, id })) : decode(slug, row),
        ),
      ),
  };
};
