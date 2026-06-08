import { literal } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type SelectMeta<Options extends ReadonlyArray<string>> = FieldMeta<{
  readonly options: Options;
}>;

export interface SelectOpts<Options extends ReadonlyArray<string>>
  extends BaseFieldOpts<Options[number]> {
  readonly options: Options;
}

export function select<
  const Options extends ReadonlyArray<string>,
  const O extends SelectOpts<Options> = SelectOpts<Options>,
>(opts: O & SelectOpts<Options>): WithLocalized<Options[number], O, SelectMeta<Options>> {
  if (opts.options.length === 0) {
    throw new Error("fields.select requires at least one option");
  }
  const meta: SelectMeta<Options> = { kind: "select", widget: "select", options: opts.options };
  return applyCommon(literal(...opts.options), opts, meta);
}
