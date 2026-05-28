import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface PolymorphicRef {
  readonly type: string;
  readonly id: string;
}

export interface PolymorphicOpts
  extends BaseFieldOpts<PolymorphicRef | ReadonlyArray<PolymorphicRef>> {
  /** Allowed target collection slugs. */
  readonly to: ReadonlyArray<string>;
  readonly many?: boolean;
}

const RefSchema = Schema.Struct({
  type: Schema.String,
  id: Schema.String,
});

export const polymorphic = <const O extends PolymorphicOpts = PolymorphicOpts>(
  opts: O & PolymorphicOpts,
): WithLocalized<PolymorphicRef | ReadonlyArray<PolymorphicRef>, O> => {
  const inner: Schema.Schema.Any = opts.many ? Schema.Array(RefSchema) : RefSchema;
  return applyCommon(inner, opts, {
    kind: "polymorphic",
    widget: "polymorphic",
    to: opts.to,
    many: opts.many ?? false,
  }) as WithLocalized<PolymorphicRef | ReadonlyArray<PolymorphicRef>, O>;
};
