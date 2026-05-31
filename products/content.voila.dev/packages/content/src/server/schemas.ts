// Payload schemas shared by every read procedure. Success/document schemas are
// per-collection (see `./document`), so the wire is typed against real fields.

import { Schema } from "effect";

export const OrderDirection = Schema.Literal("asc", "desc");

/** `<collection>.list` payload — keyset pagination knobs. */
export const ListPayload = {
  limit: Schema.optional(Schema.Number),
  cursor: Schema.optional(Schema.String),
  orderBy: Schema.optional(Schema.String),
  direction: Schema.optional(OrderDirection),
};

/** `<collection>.find` payload — lookup by primary key. */
export const FindPayload = { id: Schema.String };

/** `<collection>.findOne` payload — lookup by a single field/value. */
export const FindOnePayload = {
  field: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
};

// Write payloads carry the document under `data` as `Schema.Unknown`: the handler
// (not the RPC framework) validates it against the per-collection field schema so a
// failure becomes a typed `ValidationError` envelope rather than a protocol decode
// error. The *type* of `data` is narrowed per collection in `./types`, so the typed
// client still sees `create({ data: { title, … } })`.

/** `<collection>.create` payload — the new document's field values. */
export const CreatePayload = { data: Schema.Unknown };

/** `<collection>.update` payload — id + a partial set of field values. */
export const UpdatePayload = { id: Schema.String, data: Schema.Unknown };

/** `<collection>.delete` payload — id, optionally a hard (purge) delete. */
export const DeletePayload = { id: Schema.String, hard: Schema.optional(Schema.Boolean) };

/** `<collection>.restore` payload — id of a soft-deleted document. */
export const RestorePayload = { id: Schema.String };
