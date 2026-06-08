import { pattern as patternCheck, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DateOpts = BaseFieldOpts<string>;
export type DateMeta = FieldMeta;

// Date-only, ISO 8601 (YYYY-MM-DD). Stored as a string; a calendar date has no
// time zone, so we keep the shape close to the wire format.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function date<const O extends DateOpts = DateOpts>(
  opts?: O,
): WithLocalized<string, O, DateMeta> {
  const meta: DateMeta = { kind: "date", widget: "date" };
  return applyCommon(refine(str(), patternCheck(ISO_DATE)), opts, meta);
}
