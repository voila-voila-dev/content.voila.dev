import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface ArrayOpts<T> extends BaseFieldOpts<ReadonlyArray<T>> {
  readonly min?: number;
  readonly max?: number;
}

export const array = <
  Item extends Schema.Schema.Any,
  const O extends ArrayOpts<Schema.Schema.Type<Item>> = ArrayOpts<Schema.Schema.Type<Item>>,
>(
  item: Item,
  opts?: O,
): WithLocalized<ReadonlyArray<Schema.Schema.Type<Item>>, O> => {
  const o = opts ?? ({} as O);
  let arr: Schema.Schema.Any = Schema.Array(item);
  if (o.min !== undefined) arr = arr.pipe(Schema.minItems(o.min));
  if (o.max !== undefined) arr = arr.pipe(Schema.maxItems(o.max));
  return applyCommon(arr, o, {
    kind: "array",
    widget: "array",
    min: o.min,
    max: o.max,
  }) as WithLocalized<ReadonlyArray<Schema.Schema.Type<Item>>, O>;
};
