// Shared base options + the `applyCommon` helper every field constructor uses
// to attach voila `meta` and, when `localized: true`, wrap the inner validator
// in a wide `Record<string, T>`. `defineConfig` later narrows that record to
// the project's selected locales by reading `field.meta.localized` + the
// stashed `field.inner`.

import { record, type Validator } from "../std";
import type { FieldAccess, FieldMeta, FieldMetaBase, FieldTransform } from "./_annotation";
import type { Localized } from "./_localized";

/**
 * A voila field: a Standard Schema (`Validator<T>`) carrying its strongly-typed
 * `meta` (`M`), plus — on localized fields — the unwrapped per-locale value
 * validator under `inner` so the resolver can re-key it to the project locales.
 *
 * `M` defaults to the wide `FieldMetaBase`, so `Field<T>` is the "any field"
 * bound used by `FieldsMap`; each constructor returns a `Field<T, SpecificMeta>`
 * so `field.meta.<kindKey>` stays typed downstream.
 */
export interface Field<T = unknown, M extends FieldMetaBase = FieldMetaBase> extends Validator<T> {
  readonly meta: M;
  readonly inner?: Field;
}

export interface BaseFieldOpts<T = unknown> {
  readonly localized?: boolean;
  readonly required?: boolean;
  readonly unique?: boolean;
  readonly hidden?: boolean;
  readonly description?: string;
  readonly label?: string;
  readonly defaultValue?: T;
  readonly access?: FieldAccess;
  readonly transform?: FieldTransform<T>;
  /**
   * Override the generated DB column name. Defaults to
   * `toColumnName(fieldName)` (camelCase → snake_case). Used verbatim, so the
   * caller is responsible for picking a valid SQL identifier; the DDL layer
   * still quotes it and rejects collisions within a table.
   */
  readonly column?: string;
}

// Generic over `T` so a field's `BaseFieldOpts<T>` (whose `transform`/
// `defaultValue` are invariant in `T`) flows through without widening to
// `unknown` — that widening is what used to force an `any` here.
function pickCommon<T>(opts: BaseFieldOpts<T>): Partial<FieldMetaBase> {
  const m: Record<string, unknown> = {};
  if (opts.localized !== undefined) m.localized = opts.localized;
  if (opts.required !== undefined) m.required = opts.required;
  if (opts.unique !== undefined) m.unique = opts.unique;
  if (opts.hidden !== undefined) m.hidden = opts.hidden;
  if (opts.description !== undefined) m.description = opts.description;
  if (opts.label !== undefined) m.label = opts.label;
  if (opts.defaultValue !== undefined) m.defaultValue = opts.defaultValue;
  if (opts.access !== undefined) m.access = opts.access;
  if (opts.transform !== undefined) m.transform = opts.transform;
  if (opts.column !== undefined) m.column = opts.column;
  // `m` carries `T`-typed transform/defaultValue; `FieldMeta` erases `T`, so
  // this single assertion is the metadata-bag boundary (not a field-level cast).
  return m as Partial<FieldMetaBase>;
}

/** Attach `meta` (and optional `inner`) to a validator, producing a `Field`. */
export function makeField<T, M extends FieldMetaBase>(
  schema: Validator<T>,
  meta: M,
  inner?: Field,
): Field<T, M> {
  return inner ? { ...schema, meta, inner } : { ...schema, meta };
}

/**
 * Type-level mirror of the runtime wrap. `Opts` carrying `localized: true`
 * lifts the field type to `Localized<T>` — a `Field<Record<Locale, T>>` plus
 * the brand the `defineConfig` resolver reads to narrow the key literal.
 * Otherwise the field keeps its precise value type `T` and meta type `M`.
 */
// `[Opts]`/`[…]` tuples stop union distribution so a stray `undefined` in
// `Opts` can't silently pick the non-localized branch.
export type WithLocalized<T, Opts, M extends FieldMetaBase = FieldMetaBase> = [Opts] extends [
  { readonly localized: true },
]
  ? Localized<T>
  : Field<T, M>;

/**
 * Attach `meta` + the common options to a validator. The return type follows
 * `Opts["localized"]`: a literal `true` yields a `Localized<T>`, anything else a
 * `Field<T, M>` — so field constructors return `applyCommon(...)` verbatim with
 * no cast. The lone assertion below is the unavoidable cost of returning a type
 * that's conditional on a value TS can't follow into the branch.
 */
export function applyCommon<T, Opts extends BaseFieldOpts<T>, M extends FieldMeta>(
  inner: Validator<T>,
  opts: Opts | undefined,
  meta: M,
): WithLocalized<T, Opts, M> {
  const full: M = { ...meta, ...pickCommon<T>(opts ?? {}) };
  const field = opts?.localized
    ? // Wide form accepts any string key — `defineConfig` later rebuilds the
      // record keyed to the project's selected locales (all required).
      makeField(record(inner), full, makeField(inner, full))
    : makeField(inner, full);
  return field as WithLocalized<T, Opts, M>;
}
