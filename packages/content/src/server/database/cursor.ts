// Opaque keyset cursors. A cursor captures the order-by column's value and id of
// the last row on a page — plus the `orderBy`/`direction` it was minted under, so
// it can't be silently reused against a different ordering — base64url-encoded so
// callers treat it as opaque. Keyset (not OFFSET) pagination keeps page fetches
// O(limit) and stable under inserts.

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

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

export function encodeCursor(position: CursorPosition): string {
  return toBase64Url(
    JSON.stringify([position.value, position.id, position.orderBy, position.direction]),
  );
}

function isCursorValue(v: unknown): v is CursorPosition["value"] {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

/** Decode a cursor, or `null` if it's malformed (treated as "start from the top"). */
export function decodeCursor(cursor: string): CursorPosition | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(cursor));
    if (
      Array.isArray(parsed) &&
      parsed.length === 4 &&
      isCursorValue(parsed[0]) &&
      typeof parsed[1] === "string" &&
      typeof parsed[2] === "string" &&
      (parsed[3] === "asc" || parsed[3] === "desc")
    ) {
      return { value: parsed[0], id: parsed[1], orderBy: parsed[2], direction: parsed[3] };
    }
    return null;
  } catch {
    return null;
  }
}
