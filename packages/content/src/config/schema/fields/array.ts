import { arrayOf, type Check, maxItems, minItems, refine, type Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type Field, type WithLocalized } from "./_base";
import { isField } from "./_nested";

/**
 * `item` is the element's own field when the caller passed a voila field (the
 * normal case: `array(fields.media())`), so editors can render one widget per
 * element. A bare validator element leaves it unset and the admin falls back
 * to its unsupported-input notice.
 */
export type ArrayMeta = FieldMeta<{
  readonly min?: number;
  readonly max?: number;
  readonly item?: Field;
}>;

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
  const itemField = isField(item) ? item : undefined;
  if (itemField?.meta.localized === true) {
    throw new Error(
      "fields.array: the item field cannot be localized — set localized: true on the array instead.",
    );
  }
  const meta: ArrayMeta = {
    kind: "array",
    widget: "array",
    min: opts?.min,
    max: opts?.max,
    ...(itemField ? { item: itemField } : {}),
  };
  return applyCommon(checks.length ? refine(base, ...checks) : base, opts, meta);
}
