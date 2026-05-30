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
