// Opaque keyset cursors. A cursor captures the order-by column's value and id of
// the last row on a page — plus the `orderBy`/`direction` it was minted under, so
// it can't be silently reused against a different ordering — base64url-encoded so
// callers treat it as opaque. Keyset (not OFFSET) pagination keeps page fetches
// O(limit) and stable under inserts.

import { Option } from "effect";
import type { OrderDirection } from "./types";

export interface CursorPosition {
  /**
   * The order-by column's value on the boundary row (equals `id` when ordering
   * by id). `null` when the boundary row's order column is NULL — that row sits
   * in the trailing NULL partition (the query always orders `NULLS LAST`).
   */
  readonly value: string | number | boolean | null;
  /** The boundary row's id — the unique tiebreaker. */
  readonly id: string;
  /** The field the page was ordered by; a mismatch on reuse is rejected. */
  readonly orderBy: string;
  /** The direction the page was ordered in. */
  readonly direction: OrderDirection;
}

const toBase64Url = (s: string): string =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (s: string): string => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

export const encodeCursor = (position: CursorPosition): string =>
  toBase64Url(JSON.stringify([position.value, position.id, position.orderBy, position.direction]));

const isCursorValue = (v: unknown): v is CursorPosition["value"] =>
  v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/** Decode a cursor, or `None` if it's malformed (treated as "start from the top"). */
export const decodeCursor = (cursor: string): Option.Option<CursorPosition> => {
  try {
    const parsed = JSON.parse(fromBase64Url(cursor));
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      isCursorValue(parsed[0]) &&
      typeof parsed[1] === "string" &&
      typeof parsed[2] === "string" &&
      (parsed[3] === "asc" || parsed[3] === "desc")
    ) {
      return Option.some({
        value: parsed[0],
        id: parsed[1],
        orderBy: parsed[2],
        direction: parsed[3],
      });
    }
    return Option.none();
  } catch {
    return Option.none();
  }
};
