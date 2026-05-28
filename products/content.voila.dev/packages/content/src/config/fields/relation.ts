import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type OnDelete = "restrict" | "cascade" | "setNull";

export interface RelationOpts<T = string | ReadonlyArray<string>> extends BaseFieldOpts<T> {
  /** Target collection slug. */
  readonly to: string;
  /** True for many-to-many; otherwise one-to-one / many-to-one. */
  readonly many?: boolean;
  readonly onDelete?: OnDelete;
  /** Optional filter applied to the picker; runs server-side too. */
  readonly filter?: (ctx: unknown) => Record<string, unknown>;
  /** Override the auto-named junction table when `many: true`. */
  readonly through?: string;
}

export const relation = <const O extends RelationOpts = RelationOpts>(
  opts: O & RelationOpts,
): WithLocalized<string | ReadonlyArray<string>, O> => {
  // Stored as foreign-key id(s). The exact id format is the target's id field.
  const inner: Schema.Schema.Any = opts.many ? Schema.Array(Schema.String) : Schema.String;
  return applyCommon(inner, opts, {
    kind: "relation",
    widget: "relation",
    to: opts.to,
    many: opts.many ?? false,
    onDelete: opts.onDelete ?? "restrict",
    filter: opts.filter,
    through: opts.through,
  }) as WithLocalized<string | ReadonlyArray<string>, O>;
};
