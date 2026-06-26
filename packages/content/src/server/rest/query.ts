// Query-string parsing and unique-lookup value coercion for the read handlers.
// Pure functions — no database access — so they unit-test cheaply. Each fallible
// helper throws a typed `ApiError` (the boundary renders the envelope); the
// happy path returns the parsed shape the `Database` calls accept.
//
// Cursors are opaque tokens minted by the `Database` keyset pager, which already
// embeds the `orderBy`/`direction` they were issued under. We decode here only
// to validate the token (malformed → `INVALID_CURSOR`) and to reject a cursor
// replayed under a different ordering than the request asks for — then hand the
// original token straight back to `Database.list`.

import type { Field, FieldsMap } from "../../config/schema/fields";
import { decodeCursor } from "../database/cursor";
import type {
  DraftFilter,
  FieldValue,
  FilterOp,
  ListFilter,
  ListOpts,
  OrderDirection,
} from "../database/types";
import { badRequest, fail, invalidCursor, invalidOrder } from "./errors";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** A collection or singleton, reduced to what the read layer reads off it. */
export interface CollectionLike {
  readonly slug: string;
  readonly fields: FieldsMap;
}

/**
 * System columns present on every table, with the value-kind we sort/coerce
 * them as. `deletedAt` is intentionally absent — soft-deleted rows are hidden,
 * so ordering or looking up by it is meaningless.
 */
const SYSTEM_KINDS: Record<string, string> = {
  id: "string",
  createdAt: "datetime",
  updatedAt: "datetime",
};

/**
 * Field kinds that map to a single scalar column and are therefore orderable.
 * Excludes the JSON-backed kinds (`json`/`array`/`object`/`media`/…) and
 * localized fields (which store a per-locale JSON record regardless of kind).
 */
const SORTABLE_KINDS = new Set([
  "string",
  "slug",
  "id",
  "enum",
  "select",
  "color",
  "code",
  "markdown",
  "secret",
  "password",
  "number",
  "boolean",
  "date",
  "datetime",
  "time",
  "duration",
  "position",
]);

/**
 * The value-kind backing an orderable/queryable key, or `undefined` when the
 * key isn't a real scalar column on the collection (unknown field, a JSON-backed
 * field, or a localized field). Drives both `orderBy` validation and unique-
 * lookup value coercion.
 */
export function kindOfKey(collection: CollectionLike, key: string): string | undefined {
  const system = SYSTEM_KINDS[key];
  if (system) return system;
  const field = collection.fields[key] as Field | undefined;
  if (!field || field.meta.localized) return undefined;
  return SORTABLE_KINDS.has(field.meta.kind) ? field.meta.kind : undefined;
}

/** Parsed `?limit/orderBy/order/cursor/status` for a list request, ready for `Database.list`. */
export interface ListQuery extends ListOpts {
  readonly limit: number;
  readonly orderBy: string;
  readonly direction: OrderDirection;
  /** The original opaque cursor token, validated; absent on the first page. */
  readonly cursor?: string;
  /** Draft scoping (draft-enabled collections); absent → published-only. */
  readonly status?: DraftFilter;
  /** Server-side field predicates from `?filter=field:op:value` (repeatable). */
  readonly filters?: ReadonlyArray<ListFilter>;
  /** Project the page to just these fields (`?fields=a,b,c`); absent → all columns. */
  readonly fields?: ReadonlyArray<string>;
  /** Compute the scope's total row count alongside the page (`?count=1`). */
  readonly count?: boolean;
}

/** System columns a `?fields` projection may name alongside the config fields. */
const PROJECTABLE_SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "status",
  "publishedAt",
]);

/**
 * Parse `?fields=a,b,c` into a projection list, or `undefined` when absent. Each
 * name must be a known config field or a projectable system field — an unknown
 * one is a 400 (catching a typo before it silently returns a thinner row).
 */
export function parseFields(
  url: URL,
  collection: CollectionLike,
): ReadonlyArray<string> | undefined {
  const raw = url.searchParams.get("fields");
  if (raw === null || raw.trim() === "") return undefined;
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  for (const name of names) {
    if (collection.fields[name] === undefined && !PROJECTABLE_SYSTEM_FIELDS.has(name)) {
      fail(badRequest({ field: "fields", expected: "a known field", name }));
    }
  }
  return names.length > 0 ? names : undefined;
}

const FILTER_OPS: ReadonlySet<FilterOp> = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
]);

/**
 * Parse `?filter=field:op:value` params (repeatable) into list filters. The
 * field must be a real scalar column (same gate as `orderBy` — JSON-backed and
 * localized fields are rejected); the value is coerced to the column's type
 * (`contains` keeps the raw string for its `LIKE`). A malformed entry is a 400.
 */
export function parseFilters(url: URL, collection: CollectionLike): ReadonlyArray<ListFilter> {
  const out: ListFilter[] = [];
  for (const raw of url.searchParams.getAll("filter")) {
    const firstColon = raw.indexOf(":");
    const secondColon = raw.indexOf(":", firstColon + 1);
    if (firstColon < 1 || secondColon < 0) {
      fail(badRequest({ field: "filter", expected: "field:op:value", value: raw }));
    }
    const field = raw.slice(0, firstColon);
    const op = raw.slice(firstColon + 1, secondColon);
    const valueRaw = raw.slice(secondColon + 1);
    if (!FILTER_OPS.has(op as FilterOp)) {
      fail(badRequest({ field: "filter", expected: "eq|ne|gt|gte|lt|lte|contains", op }));
    }
    const fieldDef = collection.fields[field] as Field | undefined;
    if (fieldDef === undefined || !kindOfKey(collection, field)) {
      fail(badRequest({ field: "filter", expected: "a known scalar field", name: field }));
    }
    // `contains` binds the raw substring (a `LIKE` pattern); other ops coerce to
    // the column's stored type so the comparison binds correctly.
    const value: FieldValue = op === "contains" ? valueRaw : coerceFieldValue(fieldDef, valueRaw);
    out.push({ field, op: op as FilterOp, value });
  }
  return out;
}

/**
 * Parse `?limit`, `?orderBy`, `?order`, `?cursor`, `?status`, and `?count` for
 * a list request. Defaults: 25 rows (max 100), newest-first by `createdAt`,
 * and — for draft-enabled collections — only live published rows.
 */
export function parseListQuery(url: URL, collection: CollectionLike): ListQuery {
  const limit = parseLimit(url.searchParams.get("limit"));
  const direction = parseDirection(url.searchParams.get("order"));

  const orderBy = url.searchParams.get("orderBy") ?? "createdAt";
  if (!kindOfKey(collection, orderBy)) fail(invalidOrder(collection.slug, orderBy));

  const cursor = url.searchParams.get("cursor") ?? undefined;
  if (cursor !== undefined) {
    const decoded = decodeCursor(cursor);
    // Malformed, or replayed under a different ordering than this request — the
    // pager would compare the boundary against the wrong column either way.
    if (decoded === null || decoded.orderBy !== orderBy || decoded.direction !== direction) {
      fail(invalidCursor());
    }
  }

  const status = parseStatus(url.searchParams.get("status"));
  const filters = parseFilters(url, collection);
  const fields = parseFields(url, collection);
  const count = parseCount(url.searchParams.get("count"));
  return { limit, orderBy, direction, cursor, status, filters, fields, count };
}

/** Parse a `?status` value into a draft filter, or `undefined` when absent.
 *  Shared by the list and search routes. */
export function parseStatus(raw: string | null): DraftFilter | undefined {
  if (raw === null) return undefined;
  if (raw === "published" || raw === "draft" || raw === "scheduled" || raw === "any") return raw;
  return fail(badRequest({ field: "status", expected: "published | draft | scheduled | any" }));
}

function parseCount(raw: string | null): boolean | undefined {
  if (raw === null) return undefined;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fail(badRequest({ field: "count", expected: "1 | 0 | true | false" }));
}

/** Parse a `?limit` value: 25 by default, integer, 1–100. Shared with the
 *  revision-history list route. */
export function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    fail(badRequest({ field: "limit", max: MAX_LIMIT }));
  }
  return n;
}

function parseDirection(raw: string | null): OrderDirection {
  if (raw === null || raw === "desc") return "desc";
  if (raw === "asc") return "asc";
  return fail(badRequest({ field: "order" }));
}

/** Scalar field kinds stored as text — a unique `:value` lookup passes through verbatim. */
const TEXT_VALUE_KINDS = new Set([
  "string",
  "slug",
  "id",
  "enum",
  "select",
  "color",
  "code",
  "markdown",
  "secret",
  "password",
  "date",
  "time",
]);

/**
 * Coerce a unique-field lookup `:value` (always a URL string) into the type the
 * column stores, so it binds against the right SQL value. Kinds with no scalar
 * lookup value (JSON-backed, localized) are rejected as a bad request.
 */
export function coerceFieldValue(field: Field, raw: string): FieldValue {
  const { kind } = field.meta;
  if (field.meta.localized) {
    fail(badRequest({ field: "value", expected: "non-localized field", kind }));
  }
  if (TEXT_VALUE_KINDS.has(kind)) return raw;
  switch (kind) {
    case "number":
    case "position":
    case "duration": {
      const n = Number(raw);
      if (!Number.isFinite(n)) fail(badRequest({ field: "value", expected: "number", raw }));
      return n;
    }
    case "boolean":
      if (raw === "true" || raw === "1") return true;
      if (raw === "false" || raw === "0") return false;
      return fail(badRequest({ field: "value", expected: "boolean", raw }));
    case "datetime": {
      // Stored as epoch ms (SQLite INTEGER / Postgres TIMESTAMPTZ); the bind
      // must be the same number the column holds.
      const ms = new Date(raw).getTime();
      if (Number.isNaN(ms)) fail(badRequest({ field: "value", expected: "datetime", raw }));
      return ms;
    }
    default:
      return fail(badRequest({ field: "value", expected: "unsupported field kind", kind }));
  }
}
