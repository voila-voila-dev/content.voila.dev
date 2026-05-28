import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type BooleanOpts = BaseFieldOpts<boolean>;

export const boolean = <const O extends BooleanOpts = BooleanOpts>(
  opts?: O,
): WithLocalized<boolean, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.Boolean, o, { kind: "boolean", widget: "boolean" }) as WithLocalized<
    boolean,
    O
  >;
};
