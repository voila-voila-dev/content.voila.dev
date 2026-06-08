import { pattern as patternCheck, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type TimeOpts = BaseFieldOpts<string>;
export type TimeMeta = FieldMeta;

// HH:MM:SS (24h). Stored as a string for the same reason `date` is.
const ISO_TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export function time<const O extends TimeOpts = TimeOpts>(
  opts?: O,
): WithLocalized<string, O, TimeMeta> {
  const meta: TimeMeta = { kind: "time", widget: "time" };
  return applyCommon(refine(str(), patternCheck(ISO_TIME)), opts, meta);
}
