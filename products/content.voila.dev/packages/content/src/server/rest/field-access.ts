// Per-field access enforcement at the REST boundary. The predicates live on
// the fields themselves (`field.meta.access`, see config) so the rules travel
// with the schema; this module evaluates them against the principal the guard
// resolved. Two effects: read-denied fields are *redacted* from every row the
// API serializes (lists, finds, write echoes, revision snapshots), and a write
// payload carrying a write-denied field is *rejected* with a 403 `FORBIDDEN`
// naming the offending fields. The runtime `Database` stays principal-agnostic
// by design — a host calling it directly bypasses none of its own code.

import type { Field, FieldAccessContext } from "../../config/schema/fields";
import type { Principal } from "../auth/principal";
import type { Document } from "../database/types";
import { fail, forbidden } from "./errors";
import type { CollectionLike } from "./query";

/** The context a read-side predicate sees. Every serialization is a `read`. */
export function readAccessContext(
  collection: string,
  principal: Principal | null,
  documentId?: string,
): FieldAccessContext {
  return { principal, operation: "read", collection, documentId };
}

/**
 * Drop read-denied fields from a stored row. Returns the row untouched (same
 * reference) when nothing is redacted — the common case, since most fields
 * carry no access rules. System columns (`id`, `createdAt`, …) aren't fields,
 * so they always pass through.
 */
export function redactDocument(
  entry: CollectionLike,
  row: Document,
  ctx: FieldAccessContext,
): Document {
  let out: Document | null = null;
  for (const [name, field] of Object.entries(entry.fields) as Array<[string, Field]>) {
    if (field.meta.access?.read?.(ctx) === false) {
      if (out === null) out = { ...row };
      delete out[name];
    }
  }
  return out ?? row;
}

/**
 * Reject a write payload that touches a write-denied field. Checked after the
 * collection-level RBAC hook allowed the operation — this is the field-level
 * refinement, and it fails closed with the denied field names on the envelope.
 */
export function assertWritableFields(
  entry: CollectionLike,
  data: Document,
  ctx: FieldAccessContext,
): void {
  const denied: string[] = [];
  for (const name of Object.keys(data)) {
    const field = Object.hasOwn(entry.fields, name) ? (entry.fields[name] as Field) : undefined;
    if (field?.meta.access?.write?.(ctx) === false) denied.push(name);
  }
  if (denied.length > 0) fail(forbidden(entry.slug, ctx.operation, denied));
}

/**
 * Reject a revision restore unless the principal may write *every* guarded
 * field: restoring re-applies the snapshot's full content, so it's treated as
 * a write to each field that carries a `write` rule.
 */
export function assertRestorableFields(
  entry: CollectionLike,
  principal: Principal | null,
  documentId: string,
): void {
  const ctx: FieldAccessContext = {
    principal,
    operation: "update",
    collection: entry.slug,
    documentId,
  };
  const denied: string[] = [];
  for (const [name, field] of Object.entries(entry.fields) as Array<[string, Field]>) {
    if (field.meta.access?.write?.(ctx) === false) denied.push(name);
  }
  if (denied.length > 0) fail(forbidden(entry.slug, "update", denied));
}
