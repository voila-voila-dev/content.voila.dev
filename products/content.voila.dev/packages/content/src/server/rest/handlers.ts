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
import { localeChain } from "../../config/i18n";
import { localizeDocument } from "../../config/localize";
import type { Field, FieldsMap } from "../../config/schema/fields";
import type { Principal } from "../auth/principal";
import type { Database, Document } from "../database/types";
import {
  ApiError,
  badRequest,
  errorResponse,
  fail,
  fieldNotUnique,
  forbidden,
  internalFailure,
  notFound,
  unknownCollection,
  unknownField,
} from "./errors";
import { readAccessContext, redactDocument } from "./field-access";
import { type CollectionLike, coerceFieldValue, parseListQuery } from "./query";

/**
 * Hook fired when an unexpected throw (driver error, programming bug) is about
 * to fold to a generic `INTERNAL` 500. Typed `ApiFailure`s never reach it —
 * they're expected control flow. The default logs via `console.error` outside
 * production, so a 500's cause is never silently swallowed in dev.
 */
export type RestErrorHook = (error: unknown) => void;

function defaultOnError(error: unknown): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
  console.error(
    "[@voila/content] unexpected error in REST handler (responding 500 INTERNAL):",
    error,
  );
}

/** Everything the read handlers need: the config (for validation) and the data
 *  layer. `media` opts the dispatcher into the `_media` routes (see `rest/media`). */
export interface RestContext {
  readonly config: NormalizedConfig;
  readonly database: Database;
  readonly media?: import("./media").MediaContext;
  /** Observes unexpected errors before they fold to `INTERNAL` (see `RestErrorHook`). */
  readonly onError?: RestErrorHook;
}

// `NormalizedConfig` narrows its collection/singleton maps with a mapped type
// whose values erase to `unknown` under indexing; the read layer only ever reads
// `fields` off an entry. These two helpers are the single place that re-views the
// maps as that field-bearing shape, so the cast isn't restated at every call.
type FieldBearingMap = Record<string, { fields: FieldsMap }>;
const collectionsOf = (config: NormalizedConfig): FieldBearingMap =>
  config.collections as FieldBearingMap;
const singletonsOf = (config: NormalizedConfig): FieldBearingMap =>
  config.singletons as FieldBearingMap;

/**
 * Resolve a `:collection` URL segment against the registry. Collections and
 * singletons share a flat slug namespace, so a singleton is reachable through
 * the same routes. Throws `UNKNOWN_COLLECTION` when the slug matches neither.
 */
export function requireCollection(config: NormalizedConfig, slug: string): CollectionLike {
  const collections = collectionsOf(config);
  const singletons = singletonsOf(config);
  // `Object.hasOwn` guards against inherited keys (`"toString"`, …) before the
  // own-value read; the capture is what lets TS drop the `| undefined`.
  const collection = Object.hasOwn(collections, slug) ? collections[slug] : undefined;
  if (collection) return { slug, fields: collection.fields };
  const singleton = Object.hasOwn(singletons, slug) ? singletons[slug] : undefined;
  if (singleton) return { slug, fields: singleton.fields };
  return fail(unknownCollection(slug));
}

/** Whether a slug names a configured singleton — drives the router's split
 *  between the list/create collection routes and the get/set singleton routes. */
export function isSingleton(config: NormalizedConfig, slug: string): boolean {
  return Object.hasOwn(singletonsOf(config), slug);
}

/** Like `requireCollection`, but resolves only singletons. */
export function requireSingleton(config: NormalizedConfig, slug: string): CollectionLike {
  const singletons = singletonsOf(config);
  const singleton = Object.hasOwn(singletons, slug) ? singletons[slug] : undefined;
  if (singleton) return { slug, fields: singleton.fields };
  return fail(unknownCollection(slug));
}

/**
 * Resolve a `?locale=` request parameter against the config: absent → `null`
 * (full records), known → the fallback chain a read resolves through, unknown
 * or un-configured → 400. Localization is read-side only — writes, their
 * echoes, and revision snapshots always speak full per-locale records.
 */
export function resolveReadLocale(
  config: NormalizedConfig,
  url: URL,
): ReadonlyArray<string> | null {
  const locale = url.searchParams.get("locale");
  if (locale === null) return null;
  const i18n = config.i18n;
  if (!i18n || !(i18n.locales as ReadonlyArray<string>).includes(locale)) {
    fail(
      badRequest({
        field: "locale",
        reason: i18n ? `unknown locale "${locale}"` : "i18n is not configured",
        ...(i18n ? { locales: i18n.locales } : {}),
      }),
    );
  }
  return localeChain(i18n, locale);
}

/**
 * The one path a stored row takes onto the wire: redact read-denied fields for
 * the principal, then resolve localized fields through the locale chain. Every
 * handler that serializes a document — reads, write echoes, revision snapshots
 * — must go through here so no serialization can skip redaction. Write echoes
 * and revisions pass `chain: null`: they always speak full per-locale records.
 */
export function serializeRow(
  entry: CollectionLike,
  row: Document,
  principal: Principal | null,
  chain: ReadonlyArray<string> | null,
  documentId?: string,
): Document {
  const redacted = redactDocument(entry, row, readAccessContext(entry.slug, principal, documentId));
  return chain === null ? redacted : (localizeDocument(entry.fields, redacted, chain) as Document);
}

/**
 * Run a handler body, mapping both channels to a wire response. A thrown
 * `ApiError` carries a typed `ApiFailure`; any other throw (driver bug,
 * programming error) is reported to `onError` and folds to a generic
 * `INTERNAL` 500 so internals never leak onto the wire.
 */
export async function runHandler(
  body: () => Promise<Response>,
  onError: RestErrorHook = defaultOnError,
): Promise<Response> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.failure);
    onError(error);
    return errorResponse(internalFailure(error));
  }
}

/** `GET /:collection` — cursor-paginated list. */
export function handleList(
  ctx: RestContext,
  slug: string,
  url: URL,
  principal: Principal | null = null,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const query = parseListQuery(url, entry);
    const chain = resolveReadLocale(ctx.config, url);
    const result = await ctx.database.list(entry.slug, query);
    const data = result.documents.map((row) => serializeRow(entry, row, principal, chain));
    return Response.json({
      data,
      nextCursor: result.nextCursor,
      ...(result.total !== undefined ? { total: result.total } : {}),
    });
  }, ctx.onError);
}

/** `GET /:collection/:id` — find by primary key. `url` carries `?locale=`. */
export function handleFindById(
  ctx: RestContext,
  slug: string,
  id: string,
  principal: Principal | null = null,
  url?: URL,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const chain = url === undefined ? null : resolveReadLocale(ctx.config, url);
    const row = await ctx.database.get(entry.slug, id);
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: serializeRow(entry, row, principal, chain, id) });
  }, ctx.onError);
}

/** `GET /:singleton` — the singleton's one document as an object envelope
 *  (`{ data: {…} }`, not a list). 404 `NOT_FOUND` until the first `set` writes it. */
export function handleGetSingleton(
  ctx: RestContext,
  slug: string,
  url: URL,
  principal: Principal | null = null,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireSingleton(ctx.config, slug);
    const chain = resolveReadLocale(ctx.config, url);
    // The one row is pinned to `id = slug` by the table's CHECK constraint.
    const row = await ctx.database.get(entry.slug, entry.slug);
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: serializeRow(entry, row, principal, chain, entry.slug) });
  }, ctx.onError);
}

/** `GET /:collection/by/:field/:value` — find by a unique field. `url` carries `?locale=`. */
export function handleFindByField(
  ctx: RestContext,
  slug: string,
  fieldName: string,
  rawValue: string,
  principal: Principal | null = null,
  url?: URL,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const field = entry.fields[fieldName] as Field | undefined;
    if (!field) fail(unknownField(entry.slug, fieldName));
    if (field.meta.unique !== true) fail(fieldNotUnique(entry.slug, fieldName));
    const chain = url === undefined ? null : resolveReadLocale(ctx.config, url);
    const access = readAccessContext(entry.slug, principal);
    // Looking a row up *by* a read-denied field would confirm the field's
    // values one probe at a time — deny the lookup itself.
    if (field.meta.access?.read?.(access) === false) {
      fail(forbidden(entry.slug, "read", [fieldName]));
    }
    const value = coerceFieldValue(field, rawValue);
    const row = await ctx.database.findOne(entry.slug, fieldName, value);
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: serializeRow(entry, row, principal, chain) });
  }, ctx.onError);
}
