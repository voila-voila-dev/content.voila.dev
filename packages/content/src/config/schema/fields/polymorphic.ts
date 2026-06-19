import { arrayOf, str, struct, type Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface PolymorphicRef {
  readonly type: string;
  readonly id: string;
}

export type PolymorphicMeta = FieldMeta<{
  readonly to: ReadonlyArray<string>;
  readonly many: boolean;
}>;

export interface PolymorphicOpts
  extends BaseFieldOpts<PolymorphicRef | ReadonlyArray<PolymorphicRef>> {
  /** Allowed target collection slugs. */
  readonly to: ReadonlyArray<string>;
  readonly many?: boolean;
}

const RefSchema = struct({ type: str(), id: str() });

export function polymorphic<const O extends PolymorphicOpts = PolymorphicOpts>(
  opts: O & PolymorphicOpts,
): WithLocalized<PolymorphicRef | ReadonlyArray<PolymorphicRef>, O, PolymorphicMeta> {
  const inner: Validator<PolymorphicRef | ReadonlyArray<PolymorphicRef>> = opts.many
    ? arrayOf(RefSchema)
    : RefSchema;
  const meta: PolymorphicMeta = {
    kind: "polymorphic",
    widget: "polymorphic",
    to: opts.to,
    many: opts.many ?? false,
  };
  return applyCommon(inner, opts, meta);
}
