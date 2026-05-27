/**
 * Helpers shared by the write handlers (`POST`/`PATCH`/`DELETE`/restore):
 * request-body parsing and translation of driver-level unique-constraint
 * violations into the typed `CONFLICT` failure. Pure functions, no database
 * access — cheap to unit-test in isolation, mirroring `query.ts` on the read
 * side.
 */

import { toColumnName } from "@voila/content-database";
import type { AnyFieldDef } from "@voila/content-schema";
import { err, ok, type Result } from "../shared/result.ts";
import { type BadRequestError, badRequest } from "./errors.ts";

/**
 * Parse a JSON request body into a plain object. A non-object body (array,
 * string, `null`) or malformed JSON is a `BAD_REQUEST` — write payloads are
 * always a field map.
 */
export async function readJsonObject(
  request: Request,
): Promise<Result<Record<string, unknown>, BadRequestError>> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return err(badRequest({ reason: "invalid JSON body" }));
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return err(badRequest({ reason: "body must be a JSON object" }));
  }
  return ok(parsed as Record<string, unknown>);
}

/**
 * Heuristic detector for a unique-constraint violation across the SQLite
 * family (`bun-sqlite`, D1). SQLite reports `UNIQUE constraint failed:
 * <table>.<column>`; this matches the family without coupling to a specific
 * driver's error class.
 */
export function isUniqueViolation(cause: unknown): boolean {
  return /unique constraint failed/i.test(messageOf(cause));
}

/**
 * Best-effort recovery of the *field name* behind a unique violation. SQLite
 * names the offending `<table>.<column>`; we reverse the camelCase →
 * snake_case column mapping back to the declared field. Returns `undefined`
 * when the driver doesn't name a column we recognize — the `CONFLICT` envelope
 * then carries just the collection slug.
 */
export function uniqueViolationField(
  cause: unknown,
  fields: Record<string, AnyFieldDef>,
): string | undefined {
  const match = /unique constraint failed:\s*\w+\.(\w+)/i.exec(messageOf(cause));
  const column = match?.[1];
  if (!column) return undefined;
  for (const name of Object.keys(fields)) {
    if (name === column || toColumnName(name) === column) return name;
  }
  return undefined;
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  if (cause && typeof cause === "object" && "message" in cause) {
    return String((cause as { message: unknown }).message);
  }
  return String(cause);
}
