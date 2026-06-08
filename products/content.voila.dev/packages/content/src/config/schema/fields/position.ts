import { max as maxCheck, min as minCheck, num, refine, struct } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface Position {
  readonly latitude: number;
  readonly longitude: number;
}

export type PositionOpts = BaseFieldOpts<Position>;
export type PositionMeta = FieldMeta;

const PositionSchema = struct({
  latitude: refine(num(), minCheck(-90), maxCheck(90)),
  longitude: refine(num(), minCheck(-180), maxCheck(180)),
});

export function position<const O extends PositionOpts = PositionOpts>(
  opts?: O,
): WithLocalized<Position, O, PositionMeta> {
  const meta: PositionMeta = { kind: "position", widget: "position" };
  return applyCommon(PositionSchema, opts, meta);
}
