import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface SelectOpts<Options extends ReadonlyArray<string>>
  extends BaseFieldOpts<Options[number]> {
  readonly options: Options;
}

export const select = <
  const Options extends ReadonlyArray<string>,
  const O extends SelectOpts<Options> = SelectOpts<Options>,
>(
  opts: O & SelectOpts<Options>,
): WithLocalized<Options[number], O> => {
  if (opts.options.length === 0) {
    throw new Error("fields.select requires at least one option");
  }
  const [head, ...rest] = opts.options;
  // biome-ignore lint/suspicious/noExplicitAny: Schema.Literal's variadic signature is fine with widened strings.
  const literal = Schema.Literal(head as string, ...(rest as Array<string>)) as any;
  return applyCommon(literal, opts, {
    kind: "select",
    widget: "select",
    options: opts.options,
  }) as WithLocalized<Options[number], O>;
};
