import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DateTimeOpts = BaseFieldOpts<Date>;

// Tz-aware ISO 8601 datetime, decoded to a `Date` instance.
export const datetime = <const O extends DateTimeOpts = DateTimeOpts>(
  opts?: O,
): WithLocalized<Date, O, string> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.Date, o, { kind: "datetime", widget: "datetime" }) as WithLocalized<
    Date,
    O,
    string
  >;
};
