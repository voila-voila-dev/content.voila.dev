import { arrayOf, type Check, literal, maxItems, minItems, refine } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type MultiSelectMeta<Options extends ReadonlyArray<string>> = FieldMeta<{
  readonly options: Options;
  readonly min?: number;
  readonly max?: number;
}>;

export interface MultiSelectOpts<Options extends ReadonlyArray<string>>
  extends BaseFieldOpts<ReadonlyArray<Options[number]>> {
  readonly options: Options;
  readonly min?: number;
  readonly max?: number;
}

export function multiSelect<
  const Options extends ReadonlyArray<string>,
  const O extends MultiSelectOpts<Options> = MultiSelectOpts<Options>,
>(
  opts: O & MultiSelectOpts<Options>,
): WithLocalized<ReadonlyArray<Options[number]>, O, MultiSelectMeta<Options>> {
  if (opts.options.length === 0) {
    throw new Error("fields.multiSelect requires at least one option");
  }
  const checks: Check<ReadonlyArray<unknown>>[] = [];
  if (opts.min !== undefined) checks.push(minItems(opts.min));
  if (opts.max !== undefined) checks.push(maxItems(opts.max));
  const base = arrayOf(literal(...opts.options));
  const meta: MultiSelectMeta<Options> = {
    kind: "multiSelect",
    widget: "multiSelect",
    options: opts.options,
    min: opts.min,
    max: opts.max,
  };
  return applyCommon(checks.length ? refine(base, ...checks) : base, opts, meta);
}
