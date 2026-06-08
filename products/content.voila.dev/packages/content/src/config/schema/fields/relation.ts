import { arrayOf, str, type Validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type OnDelete = "restrict" | "cascade" | "setNull";

export type RelationMeta = FieldMeta<{
  readonly to: string;
  readonly many: boolean;
  readonly onDelete: OnDelete;
  readonly filter?: (ctx: unknown) => Record<string, unknown>;
  readonly through?: string;
}>;

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

export function relation<const O extends RelationOpts = RelationOpts>(
  opts: O & RelationOpts,
): WithLocalized<string | ReadonlyArray<string>, O, RelationMeta> {
  // Stored as foreign-key id(s). The exact id format is the target's id field.
  const inner: Validator<string | ReadonlyArray<string>> = opts.many ? arrayOf(str()) : str();
  const meta: RelationMeta = {
    kind: "relation",
    widget: "relation",
    to: opts.to,
    many: opts.many ?? false,
    onDelete: opts.onDelete ?? "restrict",
    filter: opts.filter,
    through: opts.through,
  };
  return applyCommon(inner, opts, meta);
}
