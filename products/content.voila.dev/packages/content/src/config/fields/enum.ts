import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type EnumLike = Record<string, string | number>;

export interface EnumOpts<E extends EnumLike> extends BaseFieldOpts<E[keyof E]> {
  readonly values: E;
}

/**
 * Wrap a TS enum (or const-asserted object literal) as a field. Stored as the
 * enum's value (string or number). Distinct from `select` because the option
 * keys carry semantic names (e.g. `Status.Draft`) the admin can label.
 */
export const enum_ = <const E extends EnumLike, const O extends EnumOpts<E> = EnumOpts<E>>(
  opts: O & EnumOpts<E>,
): WithLocalized<E[keyof E], O> => {
  const values = Object.values(opts.values);
  if (values.length === 0) {
    throw new Error("fields.enum requires a non-empty enum");
  }
  const [head, ...rest] = values;
  const literal = Schema.Literal(head as string | number, ...(rest as Array<string | number>));
  return applyCommon(literal, opts, {
    kind: "enum",
    widget: "select",
    values: opts.values,
  }) as WithLocalized<E[keyof E], O>;
};
