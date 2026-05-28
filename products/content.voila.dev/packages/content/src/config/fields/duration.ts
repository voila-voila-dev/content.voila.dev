import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DurationOpts = BaseFieldOpts<number>;

/**
 * ISO 8601 duration on the wire (e.g. `P1DT2H`), stored as a non-negative
 * integer number of seconds. The wire→DB transform lives in the engine; here
 * we only pin the type.
 */
export const duration = <const O extends DurationOpts = DurationOpts>(
  opts?: O,
): WithLocalized<number, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.Int.pipe(Schema.greaterThanOrEqualTo(0)), o, {
    kind: "duration",
    widget: "duration",
  }) as WithLocalized<number, O>;
};
