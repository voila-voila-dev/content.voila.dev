import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface NumberOpts extends BaseFieldOpts<number> {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
  readonly step?: number;
}

export const number = <const O extends NumberOpts = NumberOpts>(
  opts?: O,
): WithLocalized<number, O> => {
  const o = opts ?? ({} as O);
  let s: Schema.Schema.Any = o.integer ? Schema.Int : Schema.Number;
  if (o.min !== undefined) s = s.pipe(Schema.greaterThanOrEqualTo(o.min));
  if (o.max !== undefined) s = s.pipe(Schema.lessThanOrEqualTo(o.max));
  return applyCommon(s, o, {
    kind: "number",
    widget: "number",
    integer: o.integer,
    min: o.min,
    max: o.max,
    step: o.step,
  }) as WithLocalized<number, O>;
};
