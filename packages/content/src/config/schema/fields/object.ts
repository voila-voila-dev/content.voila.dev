import type { InferShape, Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";
import { assertNotLocalized, fieldsStruct } from "./_nested";

export type ObjectShape = Readonly<Record<string, Validator<unknown>>>;

/** The decoded value of an object field — `optional(x)` members become optional keys. */
export type ObjectValue<S extends ObjectShape> = InferShape<S>;

/**
 * `shape` keeps the members' own fields so editors can render one widget per
 * member (`keys` is the same list, kept for callers that only need names).
 */
export type ObjectMeta = FieldMeta<{
  readonly keys: ReadonlyArray<string>;
  readonly shape: ObjectShape;
}>;

export type ObjectOpts<S extends ObjectShape> = BaseFieldOpts<ObjectValue<S>>;

/**
 * Members that are voila fields follow the write path's blank rule: an empty
 * optional member is omitted, an empty `required` member fails with
 * "Required." under its key. Bare validators (`str()`, `num()`) always run.
 */
export function object<
  const Shape extends ObjectShape,
  const O extends ObjectOpts<Shape> = ObjectOpts<Shape>,
>(shape: Shape, opts?: O): WithLocalized<ObjectValue<Shape>, O, ObjectMeta> {
  assertNotLocalized(shape, "fields.object");
  const meta: ObjectMeta = {
    kind: "object",
    widget: "object",
    keys: Object.keys(shape),
    shape,
  };
  return applyCommon(fieldsStruct(shape), opts, meta);
}
