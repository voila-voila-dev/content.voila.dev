import { type InferShape, struct, type Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type ObjectShape = Readonly<Record<string, Validator<unknown>>>;

/** The decoded value of an object field — `optional(x)` members become optional keys. */
export type ObjectValue<S extends ObjectShape> = InferShape<S>;

export type ObjectMeta = FieldMeta<{ readonly keys: ReadonlyArray<string> }>;

export type ObjectOpts<S extends ObjectShape> = BaseFieldOpts<ObjectValue<S>>;

export function object<
  const Shape extends ObjectShape,
  const O extends ObjectOpts<Shape> = ObjectOpts<Shape>,
>(shape: Shape, opts?: O): WithLocalized<ObjectValue<Shape>, O, ObjectMeta> {
  const meta: ObjectMeta = { kind: "object", widget: "object", keys: Object.keys(shape) };
  return applyCommon(struct(shape), opts, meta);
}
