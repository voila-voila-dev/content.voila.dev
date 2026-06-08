import { literal, type Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type EnumLike = Record<string, string | number>;
export type EnumMeta<E extends EnumLike> = FieldMeta<{ readonly values: E }>;

export interface EnumOpts<E extends EnumLike> extends BaseFieldOpts<E[keyof E]> {
  readonly values: E;
}

/**
 * Wrap a TS enum (or const-asserted object literal) as a field. Stored as the
 * enum's value (string or number). Distinct from `select` because the option
 * keys carry semantic names (e.g. `Status.Draft`) the admin can label.
 */
export function enum_<const E extends EnumLike, const O extends EnumOpts<E> = EnumOpts<E>>(
  opts: O & EnumOpts<E>,
): WithLocalized<E[keyof E], O, EnumMeta<E>> {
  const values = Object.values(opts.values);
  if (values.length === 0) {
    throw new Error("fields.enum requires a non-empty enum");
  }
  const meta: EnumMeta<E> = { kind: "enum", widget: "select", values: opts.values };
  // `Object.values` erases the literal union back to `string | number`; re-pin
  // it to the enum's value type so the field carries `E[keyof E]`.
  const inner = literal(...values) as Validator<E[keyof E]>;
  return applyCommon(inner, opts, meta);
}
