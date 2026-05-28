import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type ObjectShape = Readonly<Record<string, Schema.Schema.Any>>;

export type ObjectValue<S extends ObjectShape> = {
  readonly [K in keyof S]: Schema.Schema.Type<S[K]>;
};

export type ObjectOpts<S extends ObjectShape> = BaseFieldOpts<ObjectValue<S>>;

export const object = <
  const Shape extends ObjectShape,
  const O extends ObjectOpts<Shape> = ObjectOpts<Shape>,
>(
  shape: Shape,
  opts?: O,
): WithLocalized<ObjectValue<Shape>, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.Struct(shape), o, {
    kind: "object",
    widget: "object",
    keys: Object.keys(shape),
  }) as WithLocalized<ObjectValue<Shape>, O>;
};
