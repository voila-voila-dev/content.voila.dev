import { arrayOf, type Check, maxItems, minItems, refine, type Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type ArrayMeta = FieldMeta<{ readonly min?: number; readonly max?: number }>;

export interface ArrayOpts<T> extends BaseFieldOpts<ReadonlyArray<T>> {
  readonly min?: number;
  readonly max?: number;
}

export function array<T, const O extends ArrayOpts<T> = ArrayOpts<T>>(
  item: Validator<T>,
  opts?: O,
): WithLocalized<ReadonlyArray<T>, O, ArrayMeta> {
  const checks: Check<ReadonlyArray<unknown>>[] = [];
  if (opts?.min !== undefined) checks.push(minItems(opts.min));
  if (opts?.max !== undefined) checks.push(maxItems(opts.max));
  const base = arrayOf(item);
  const meta: ArrayMeta = { kind: "array", widget: "array", min: opts?.min, max: opts?.max };
  return applyCommon(checks.length ? refine(base, ...checks) : base, opts, meta);
}
