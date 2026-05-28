import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface Position {
  readonly latitude: number;
  readonly longitude: number;
}

export type PositionOpts = BaseFieldOpts<Position>;

const PositionSchema = Schema.Struct({
  latitude: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-90), Schema.lessThanOrEqualTo(90)),
  longitude: Schema.Number.pipe(Schema.greaterThanOrEqualTo(-180), Schema.lessThanOrEqualTo(180)),
});

export const position = <const O extends PositionOpts = PositionOpts>(
  opts?: O,
): WithLocalized<Position, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(PositionSchema, o, {
    kind: "position",
    widget: "position",
  }) as WithLocalized<Position, O>;
};
