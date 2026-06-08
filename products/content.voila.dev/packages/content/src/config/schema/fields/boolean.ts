import { bool } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type BooleanOpts = BaseFieldOpts<boolean>;
export type BooleanMeta = FieldMeta;

export function boolean<const O extends BooleanOpts = BooleanOpts>(
  opts?: O,
): WithLocalized<boolean, O, BooleanMeta> {
  const meta: BooleanMeta = { kind: "boolean", widget: "boolean" };
  return applyCommon(bool(), opts, meta);
}
