import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DateOpts = BaseFieldOpts<string>;

// Date-only, ISO 8601 (YYYY-MM-DD). Stored as a string; tighter `Date` parsing
// happens in `datetime` — a calendar date has no time zone, so we keep the
// shape close to the wire format.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const date = <const O extends DateOpts = DateOpts>(opts?: O): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.String.pipe(Schema.pattern(ISO_DATE)), o, {
    kind: "date",
    widget: "date",
  }) as WithLocalized<string, O>;
};
