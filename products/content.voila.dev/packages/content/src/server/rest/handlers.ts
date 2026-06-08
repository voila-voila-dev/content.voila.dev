// The three read handlers — list, find-by-id, find-by-field — over the runtime
// `Database`. Each is a linear async function: resolve the collection against
// the config (typed envelope errors, not a generic 500), validate the request,
// call `Database`, and shape the success envelope. Failures travel through the
// `throw` channel as `ApiError`; `runHandler` is the single place that renders
// any failure to a `Response`.
//
// Success envelopes match the wire contract: a single row is `{ data }`, a list
// is `{ data, nextCursor }` (keyset pagination — no offset). Reads exclude
// soft-deleted rows; that scoping lives in `Database`.

import type { NormalizedConfig } from "../../config/config";
import type { Field, FieldsMap } from "../../config/schema/fields";
import type { Database } from "../database/types";
import {
  ApiError,
  type ApiFailure,
  errorResponse,
  fail,
  fieldNotUnique,
  internalFailure,
  notFound,
  unknownCollection,
  unknownField,
} from "./errors";
import { type CollectionLike, coerceFieldValue, parseListQuery } from "./query";

/** Everything the read handlers need: the config (for validation) and the data layer. */
export interface RestContext {
  readonly config: NormalizedConfig;
  readonly database: Database;
}

/**
 * Resolve a `:collection` URL segment against the registry. Collections and
 * singletons share a flat slug namespace, so a singleton is reachable through
 * the same routes. Throws `UNKNOWN_COLLECTION` when the slug matches neither.
 */
export function requireCollection(config: NormalizedConfig, slug: string): CollectionLike {
  // `NormalizedConfig` narrows its maps with a mapped type whose values erase to
  // `unknown` under indexing; re-view them as the field-bearing shape we read.
  const collections = config.collections as Record<string, { fields: FieldsMap }>;
  const singletons = config.singletons as Record<string, { fields: FieldsMap }>;
  // `Object.hasOwn` guards against inherited keys (`"toString"`, …) before the
  // own-value read; the capture is what lets TS drop the `| undefined`.
  const collection = Object.hasOwn(collections, slug) ? collections[slug] : undefined;
  if (collection) return { slug, fields: collection.fields };
  const singleton = Object.hasOwn(singletons, slug) ? singletons[slug] : undefined;
  if (singleton) return { slug, fields: singleton.fields };
  return fail(unknownCollection(slug));
}

/**
 * Run a handler body, mapping both channels to a wire response. A thrown
 * `ApiError` carries a typed `ApiFailure`; any other throw (driver bug,
 * programming error) folds to a generic `INTERNAL` 500 so internals never leak.
 */
export async function runHandler(body: () => Promise<Response>): Promise<Response> {
  try {
    return await body();
  } catch (error) {
    const failure: ApiFailure = error instanceof ApiError ? error.failure : internalFailure(error);
    return errorResponse(failure);
  }
}

/** `GET /:collection` — cursor-paginated list. */
export function handleList(ctx: RestContext, slug: string, url: URL): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const query = parseListQuery(url, entry);
    const result = await ctx.database.list(entry.slug, query);
    return Response.json({ data: result.documents, nextCursor: result.nextCursor });
  });
}

/** `GET /:collection/:id` — find by primary key. */
export function handleFindById(ctx: RestContext, slug: string, id: string): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const row = await ctx.database.get(entry.slug, id);
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}

/** `GET /:collection/by/:field/:value` — find by a unique field. */
export function handleFindByField(
  ctx: RestContext,
  slug: string,
  fieldName: string,
  rawValue: string,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const field = entry.fields[fieldName] as Field | undefined;
    if (!field) fail(unknownField(entry.slug, fieldName));
    if (field.meta.unique !== true) fail(fieldNotUnique(entry.slug, fieldName));
    const value = coerceFieldValue(field, rawValue);
    const row = await ctx.database.findOne(entry.slug, fieldName, value);
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}
