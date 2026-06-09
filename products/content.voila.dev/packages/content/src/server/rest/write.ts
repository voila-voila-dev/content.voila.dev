// The four write handlers — create, update, soft-delete, restore — over the
// runtime `Database`. They mirror the read handlers' shape: resolve the
// collection, validate the request body against the config's field schemas, call
// `Database`, and shape the success envelope. Failures travel through the `throw`
// channel as `ApiError`; the shared `runHandler` boundary renders any failure.
//
// Validation runs field-by-field against each field's Standard Schema, so the
// 422 envelope carries precise `{ path, message }` issues. A unique-constraint
// violation surfaced by `Database` becomes a typed `CONFLICT` (409); any other
// driver throw folds to `INTERNAL` (500) like the read path.

import type { Field } from "../../config/schema/fields";
import type { Issue } from "../../config/schema/std";
import { validateSync } from "../../config/schema/std";
import { DatabaseError } from "../database/database";
import type { Document } from "../database/types";
import { badRequest, conflict, fail, notFound, type ValidationIssue, validation } from "./errors";
import { type RestContext, requireCollection, runHandler } from "./handlers";
import type { CollectionLike } from "./query";

// Columns the server owns. A client is free to send them (a round-tripped row,
// say), but they're never validated or written — `Database` stamps them.
// `status`/`publishedAt` are managed via the publish/unpublish routes, not writes.
const SYSTEM_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "status",
  "publishedAt",
]);

// Flatten a Standard Schema issue path (which may carry `{ key }` segments) to
// the plain `(string | number)[]` the wire envelope uses.
function normalizePath(path: Issue["path"]): Array<string | number> {
  if (!path) return [];
  return path.map((seg) => {
    const key = typeof seg === "object" ? seg.key : seg;
    return typeof key === "number" ? key : String(key);
  });
}

/**
 * Validate a write payload against a collection's field schemas, returning the
 * decoded field values ready for `Database`. Unknown keys and (on a full create)
 * missing required fields are reported alongside per-field schema failures, all
 * in one 422 `VALIDATION` envelope. `partial` skips the required-presence check
 * so an update can patch a subset of fields.
 */
export function validateWrite(
  entry: CollectionLike,
  data: Document,
  opts: { readonly partial: boolean },
): Document {
  const issues: ValidationIssue[] = [];
  const out: Document = {};

  // Flag stray keys (typos, fields from another collection) before the per-field
  // pass; server-owned system columns are silently ignored rather than rejected.
  for (const key of Object.keys(data)) {
    if (SYSTEM_FIELDS.has(key)) continue;
    if (!Object.hasOwn(entry.fields, key)) {
      issues.push({ path: [key], message: `Unknown field "${key}".` });
    }
  }

  for (const [name, field] of Object.entries(entry.fields) as Array<[string, Field]>) {
    if (!Object.hasOwn(data, name)) {
      if (!opts.partial && field.meta.required === true) {
        issues.push({ path: [name], message: "Required." });
      }
      continue;
    }
    const result = validateSync(field, data[name]);
    if (result.issues) {
      for (const issue of result.issues) {
        issues.push({ path: [name, ...normalizePath(issue.path)], message: issue.message });
      }
    } else {
      out[name] = result.value;
    }
  }

  if (issues.length > 0) fail(validation(entry.slug, issues));
  return out;
}

/**
 * Read the request body as a write payload: a JSON object `{ data: {...} }`.
 * Malformed JSON or a missing/non-object `data` is a 400 `BAD_REQUEST` — the
 * field shapes themselves are checked later by `validateWrite`.
 */
async function parseWriteBody(request: Request): Promise<Document> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(badRequest({ reason: "body is not valid JSON" }));
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(badRequest({ reason: "body must be a JSON object" }));
  }
  const data = (body as { readonly data?: unknown }).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return fail(badRequest({ field: "data", reason: "expected an object" }));
  }
  return data as Document;
}

// Run a `Database` write, translating a unique-constraint `DatabaseError` into a
// typed `CONFLICT`. Any other driver error escapes to `runHandler` → `INTERNAL`.
async function runWrite<A>(slug: string, fn: () => Promise<A>): Promise<A> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DatabaseError && error.conflict) fail(conflict(slug, error.field));
    throw error;
  }
}

/** `POST /:collection` — create a document from `{ data }`. Echoes the stored row (201). */
export function handleCreate(ctx: RestContext, slug: string, request: Request): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const body = await parseWriteBody(request);
    const values = validateWrite(entry, body, { partial: false });
    const row = await runWrite(entry.slug, () => ctx.database.create(entry.slug, values));
    return Response.json({ data: row }, { status: 201 });
  });
}

/** `PATCH /:collection/:id` — patch a live document from `{ data }`. Echoes the stored row. */
export function handleUpdate(
  ctx: RestContext,
  slug: string,
  id: string,
  request: Request,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const body = await parseWriteBody(request);
    const values = validateWrite(entry, body, { partial: true });
    const row = await runWrite(entry.slug, () => ctx.database.update(entry.slug, id, values));
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}

/** `DELETE /:collection/:id` — soft-delete a live document. */
export function handleDelete(ctx: RestContext, slug: string, id: string): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const deleted = await ctx.database.softDelete(entry.slug, id);
    if (!deleted) fail(notFound(entry.slug));
    return Response.json({ data: { id } });
  });
}

/** `POST /:collection/:id/restore` — clear `deletedAt` on a soft-deleted document. */
export function handleRestore(ctx: RestContext, slug: string, id: string): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const row = await ctx.database.restore(entry.slug, id);
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}

/** Optional `{ at }` (epoch ms) on a publish body — a future value schedules go-live. */
async function parsePublishAt(request: Request): Promise<number | undefined> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // An empty / non-JSON body just means "publish now".
    return undefined;
  }
  if (typeof body !== "object" || body === null) return undefined;
  const at = (body as { readonly at?: unknown }).at;
  if (at === undefined || at === null) return undefined;
  if (typeof at !== "number" || !Number.isFinite(at)) {
    fail(badRequest({ field: "at", expected: "epoch-ms number" }));
  }
  return at;
}

// Translate a `Database` publish-state error (e.g. collection isn't
// draft-enabled) into a 400 instead of letting it fold to a generic 500.
async function runPublish(
  slug: string,
  fn: () => Promise<Document | null>,
): Promise<Document | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DatabaseError)
      fail(badRequest({ collection: slug, reason: error.message }));
    throw error;
  }
}

/** `POST /:collection/:id/publish` — publish a document (optional `{ at }` to schedule). */
export function handlePublish(
  ctx: RestContext,
  slug: string,
  id: string,
  request: Request,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const at = await parsePublishAt(request);
    const row = await runPublish(entry.slug, () =>
      ctx.database.publish(entry.slug, id, at !== undefined ? { at } : {}),
    );
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}

/** `POST /:collection/:id/unpublish` — return a document to draft. */
export function handleUnpublish(ctx: RestContext, slug: string, id: string): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const row = await runPublish(entry.slug, () => ctx.database.unpublish(entry.slug, id));
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}
