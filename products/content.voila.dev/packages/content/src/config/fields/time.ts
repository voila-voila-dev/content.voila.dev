import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type TimeOpts = BaseFieldOpts<string>;

// HH:MM:SS (24h). Stored as a string for the same reason `date` is.
const ISO_TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export const time = <const O extends TimeOpts = TimeOpts>(opts?: O): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.String.pipe(Schema.pattern(ISO_TIME)), o, {
    kind: "time",
    widget: "time",
  }) as WithLocalized<string, O>;
};
