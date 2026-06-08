import { integer as integerCheck, min as minCheck, num, refine } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DurationOpts = BaseFieldOpts<number>;
export type DurationMeta = FieldMeta;

/**
 * ISO 8601 duration on the wire (e.g. `P1DT2H`), stored as a non-negative
 * integer number of seconds. The wire→DB transform lives in the engine; here
 * we only pin the type.
 */
export function duration<const O extends DurationOpts = DurationOpts>(
  opts?: O,
): WithLocalized<number, O, DurationMeta> {
  const meta: DurationMeta = { kind: "duration", widget: "duration" };
  return applyCommon(refine(num(), integerCheck(), minCheck(0)), opts, meta);
}
