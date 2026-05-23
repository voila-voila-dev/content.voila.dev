/**
 * Query-string parsing, value coercion, and opaque cursor (de)serialization
 * shared by the read handlers. Pure functions — no database access — so they're
 * cheap to unit test in isolation.
 *
 * Every fallible helper returns `Result<T, …>` with a narrowed error union so
 * the compiler tracks exactly which failures it can produce.
 */

import type { AnyFieldDef } from "@voila/content-schema";
import { err, ok, type Result } from "../shared/result.ts";
import type { AnyCollection, AnySingleton } from "../types.ts";
import {
  type BadRequestError,
  badRequest,
  type InvalidCursorError,
  type InvalidOrderError,
  invalidCursor,
  invalidOrder,
} from "./errors.ts";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export type Direction = "asc" | "desc";

type CollectionLike = AnyCollection | AnySingleton;

/**
 * System columns present on every generated table, with the value kind we use
 * to coerce/compare them. `id` sorts as a string; the timestamps as datetimes.
 */
const SYSTEM_KINDS: Record<string, string> = {
  id: "string",
  createdAt: "datetime",
  updatedAt: "datetime",
};

/** Field kinds that map to a single scalar column and are therefore orderable. */
const SORTABLE_KINDS = new Set(["string", "number", "boolean", "date", "datetime"]);

/**
 * The value-kind backing an orderable/queryable key, or `undefined` if the key
 * isn't a real sortable column on the collection (unknown field, or a `json`
 * field that has no meaningful ordering). Drives both `orderBy` validation and
 * cursor value revival.
 */
export function kindOfKey(collection: CollectionLike, key: string): string | undefined {
  const system = SYSTEM_KINDS[key];
  if (system) return system;
  const field = collection.fields[key] as AnyFieldDef | undefined;
  if (!field) return undefined;
  return SORTABLE_KINDS.has(field.kind) ? field.kind : undefined;
}

/** A cursor decoded from the wire: the boundary order value plus the id tiebreaker. */
export interface DecodedCursor {
  /** Order-column value at the page boundary, JSON-stable (datetimes as epoch ms). */
  readonly c: unknown;
  /** Tiebreaker row id of the last row on the previous page. */
  readonly id: string;
}

export interface ListQuery {
  readonly limit: number;
  readonly orderKey: string;
  readonly direction: Direction;
  readonly cursor: DecodedCursor | null;
}

export type ParseListQueryError = BadRequestError | InvalidOrderError | InvalidCursorError;

/**
 * Parse `?limit`, `?orderBy`, `?order`, and `?cursor` for a list request.
 * Defaults: 25 rows (max 100), newest-first by `createdAt`.
 */
export function parseListQuery(
  url: URL,
  collection: CollectionLike,
): Result<ListQuery, ParseListQueryError> {
  const limit = parseLimit(url.searchParams.get("limit"));
  if (!limit.ok) return limit;

  const direction = parseDirection(url.searchParams.get("order"));
  if (!direction.ok) return direction;

  const orderKey = url.searchParams.get("orderBy") ?? "createdAt";
  if (!kindOfKey(collection, orderKey)) {
    return err(invalidOrder(collection.slug, orderKey));
  }

  const cursorParam = url.searchParams.get("cursor");
  let cursor: DecodedCursor | null = null;
  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (!decoded.ok) return decoded;
    cursor = decoded.value;
  }

  return ok({ limit: limit.value, orderKey, direction: direction.value, cursor });
}

function parseLimit(raw: string | null): Result<number, BadRequestError> {
  if (raw == null) return ok(DEFAULT_LIMIT);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    return err(badRequest({ field: "limit", max: MAX_LIMIT }));
  }
  return ok(n);
}

function parseDirection(raw: string | null): Result<Direction, BadRequestError> {
  if (raw == null || raw === "desc") return ok("desc");
  if (raw === "asc") return ok("asc");
  return err(badRequest({ field: "order" }));
}

/**
 * Coerce a unique-field lookup `:value` (always a URL string) into the type the
 * column stores. `json` fields can't be looked up by value.
 */
export function coerceFieldValue(
  field: AnyFieldDef,
  raw: string,
): Result<unknown, BadRequestError> {
  switch (field.kind) {
    case "string":
    case "date":
      return ok(raw);
    case "number": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return err(badRequest({ field: "value", expected: "number", raw }));
      return ok(n);
    }
    case "boolean":
      if (raw === "true" || raw === "1") return ok(true);
      if (raw === "false" || raw === "0") return ok(false);
      return err(badRequest({ field: "value", expected: "boolean", raw }));
    case "datetime": {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) {
        return err(badRequest({ field: "value", expected: "datetime", raw }));
      }
      return ok(d);
    }
    default:
      return err(
        badRequest({ field: "value", expected: "unsupported field kind", kind: field.kind }),
      );
  }
}

/** Extract the order value from a row for embedding in a cursor (JSON-stable). */
export function cursorValueOf(orderKey: string, row: Record<string, unknown>): unknown {
  const value = row[orderKey];
  return value instanceof Date ? value.getTime() : value;
}

/** Rebuild a comparable boundary value from a decoded cursor for the order column. */
export function reviveCursorValue(
  collection: CollectionLike,
  orderKey: string,
  raw: unknown,
): unknown {
  return kindOfKey(collection, orderKey) === "datetime" ? new Date(Number(raw)) : raw;
}

/** Base64url-encode a cursor payload. Tokens are opaque to clients. */
export function encodeCursor(cursor: DecodedCursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url cursor token, rejecting anything malformed. */
export function decodeCursor(token: string): Result<DecodedCursor, InvalidCursorError> {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as DecodedCursor).id !== "string" ||
      !("c" in parsed)
    ) {
      return err(invalidCursor());
    }
    return ok(parsed as DecodedCursor);
  } catch {
    return err(invalidCursor());
  }
}
