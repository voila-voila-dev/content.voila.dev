import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DateTimeOpts = BaseFieldOpts<Date>;

// A timestamp decoded to a `Date`. Its encoded form is epoch milliseconds — the
// same representation the `datetime` column stores (SQLite `INTEGER`, Postgres
// `TIMESTAMPTZ`) and that the system `createdAt`/`updatedAt` columns use — so the
// schema round-trips against the database with no conversion shim.
export const datetime = <const O extends DateTimeOpts = DateTimeOpts>(
  opts?: O,
): WithLocalized<Date, O, number> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.DateFromNumber, o, {
    kind: "datetime",
    widget: "datetime",
  }) as WithLocalized<Date, O, number>;
};
