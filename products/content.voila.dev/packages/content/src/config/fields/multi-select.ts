import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface MultiSelectOpts<Options extends ReadonlyArray<string>>
  extends BaseFieldOpts<ReadonlyArray<Options[number]>> {
  readonly options: Options;
  readonly min?: number;
  readonly max?: number;
}

export const multiSelect = <
  const Options extends ReadonlyArray<string>,
  const O extends MultiSelectOpts<Options> = MultiSelectOpts<Options>,
>(
  opts: O & MultiSelectOpts<Options>,
): WithLocalized<ReadonlyArray<Options[number]>, O> => {
  if (opts.options.length === 0) {
    throw new Error("fields.multiSelect requires at least one option");
  }
  const [head, ...rest] = opts.options;
  // biome-ignore lint/suspicious/noExplicitAny: literal arity is verified at call sites by the tuple generic.
  const literal = Schema.Literal(head as string, ...(rest as Array<string>)) as any;
  let arr: Schema.Schema.Any = Schema.Array(literal);
  if (opts.min !== undefined) arr = arr.pipe(Schema.minItems(opts.min));
  if (opts.max !== undefined) arr = arr.pipe(Schema.maxItems(opts.max));
  return applyCommon(arr, opts, {
    kind: "multiSelect",
    widget: "multiSelect",
    options: opts.options,
    min: opts.min,
    max: opts.max,
  }) as WithLocalized<ReadonlyArray<Options[number]>, O>;
};
