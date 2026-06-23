import {
  type Check,
  integer as integerCheck,
  max as maxCheck,
  min as minCheck,
  num,
  refine,
} from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type NumberMeta = FieldMeta<{
  readonly integer?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}>;

export interface NumberOpts extends BaseFieldOpts<number> {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
  readonly step?: number;
}

export function number<const O extends NumberOpts = NumberOpts>(
  opts?: O,
): WithLocalized<number, O, NumberMeta> {
  const checks: Check<number>[] = [];
  if (opts?.integer) checks.push(integerCheck());
  if (opts?.min !== undefined) checks.push(minCheck(opts.min));
  if (opts?.max !== undefined) checks.push(maxCheck(opts.max));
  const meta: NumberMeta = {
    kind: "number",
    widget: "number",
    integer: opts?.integer,
    min: opts?.min,
    max: opts?.max,
    step: opts?.step,
  };
  return applyCommon(checks.length ? refine(num(), ...checks) : num(), opts, meta);
}
