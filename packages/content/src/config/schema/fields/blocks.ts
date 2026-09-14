// `fields.blocks({ types })` — an ordered, polymorphic list: every item is
// `{ type: "<key>", ...fields }` where `type` picks one of the declared block
// types and the rest is that type's own field map. The page-builder primitive:
// a `pages` collection declares its section catalogue once, the admin offers
// the catalogue as an "Add block" menu and edits each block's fields inline,
// and the site renders the stored list with an exhaustive `switch (block.type)`.
//
// Storage is one JSON column. Each type's `fields` map stays on
// `meta.types[type].fields`, so the admin resolves nested widgets through the
// same registry as top-level fields (media, relations, rich text inside a block
// all work). Nested fields can't be localized — localize the blocks field.

import {
  arrayOf,
  type Check,
  fail,
  type InferShape,
  literal,
  maxItems,
  minItems,
  refine,
  type Validator,
  validateSync,
  validator,
} from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";
import type { FieldsMap } from "./_map";
import { assertNotLocalized, fieldsStruct, humanizeKey } from "./_nested";

/** One block type: the fields each block of that type carries, plus editor chrome. */
export interface BlockDef<F extends FieldsMap = FieldsMap> {
  readonly fields: F;
  /** Picker label; defaults to the humanized key. */
  readonly label?: string;
  /** One-line hint under the label in the picker. */
  readonly description?: string;
  /** Phosphor icon name, same convention as `groups[].icon`. */
  readonly icon?: string;
}

export type BlockTypes = Readonly<Record<string, BlockDef>>;

/** The stored shape of one block — a discriminated union over the type keys. */
export type BlockValue<Types extends BlockTypes> = {
  readonly [K in keyof Types & string]: { readonly type: K } & InferShape<Types[K]["fields"]>;
}[keyof Types & string];

export type BlocksValue<Types extends BlockTypes> = ReadonlyArray<BlockValue<Types>>;

/** Normalized per-type meta the admin renders from (`label` always present). */
export interface BlockTypeMeta {
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly fields: FieldsMap;
}

export type BlocksMeta = FieldMeta<{
  readonly types: Readonly<Record<string, BlockTypeMeta>>;
  readonly min?: number;
  readonly max?: number;
}>;

export interface BlocksOpts<Types extends BlockTypes> extends BaseFieldOpts<BlocksValue<Types>> {
  readonly types: Types;
  readonly min?: number;
  readonly max?: number;
}

function blockValidator(types: BlockTypes): Validator<unknown> {
  const structs = Object.fromEntries(
    Object.entries(types).map(([type, def]) => [
      type,
      fieldsStruct(def.fields, { type: literal(type) }),
    ]),
  );
  return validator((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("Expected a block");
    const type = (v as { type?: unknown }).type;
    const struct = typeof type === "string" ? structs[type] : undefined;
    if (!struct) return fail(`Unknown block type "${String(type)}"`, ["type"]);
    return validateSync(struct, v);
  });
}

export function blocks<
  const Types extends BlockTypes,
  const O extends BlocksOpts<Types> = BlocksOpts<Types>,
>(opts: O & BlocksOpts<Types>): WithLocalized<BlocksValue<Types>, O, BlocksMeta> {
  const keys = Object.keys(opts.types);
  if (keys.length === 0) throw new Error("fields.blocks: at least one block type is required");
  const types: Record<string, BlockTypeMeta> = {};
  for (const key of keys) {
    const def = opts.types[key] as BlockDef;
    assertNotLocalized(def.fields, `fields.blocks type "${key}"`);
    types[key] = {
      label: def.label ?? humanizeKey(key),
      ...(def.description !== undefined ? { description: def.description } : {}),
      ...(def.icon !== undefined ? { icon: def.icon } : {}),
      fields: def.fields,
    };
  }
  const checks: Check<ReadonlyArray<unknown>>[] = [];
  if (opts.min !== undefined) checks.push(minItems(opts.min));
  if (opts.max !== undefined) checks.push(maxItems(opts.max));
  const base = arrayOf(blockValidator(opts.types)) as Validator<BlocksValue<Types>>;
  const meta: BlocksMeta = {
    kind: "blocks",
    widget: "blocks",
    types,
    min: opts.min,
    max: opts.max,
  };
  return applyCommon(checks.length ? refine(base, ...checks) : base, opts, meta);
}
