// Shared base options + the `applyCommon` helper every field constructor uses
// to attach voila annotations and, when `localized: true`, wrap the inner
// schema in `Record<Literal<...LOCALES>, T>`. `defineConfig` later narrows
// that key literal to the project's selected locales subset by reading the
// `[VoilaInner]` annotation we stash alongside the wrap.

import { Schema } from "effect";
import {
  type FieldAccess,
  type FieldMeta,
  type FieldTransform,
  VoilaField,
  VoilaInner,
} from "./_annotation";
import type { Localized } from "./_localized";

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
}

const pickCommon = (opts: BaseFieldOpts): Partial<FieldMeta> => {
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
  return m as Partial<FieldMeta>;
};

/**
 * Type-level mirror of the runtime wrap. `Opts` carrying `localized: true`
 * lifts the field type to `Localized<T>` — `Schema<Record<Locale, T>>` plus
 * the brand the `defineConfig` resolver reads to narrow the key literal.
 */
export type WithLocalized<T, Opts, I = T> = Opts extends { readonly localized: true }
  ? Localized<T>
  : Schema.Schema<T, I>;

export const applyCommon = (
  inner: Schema.Schema.Any,
  // biome-ignore lint/suspicious/noExplicitAny: invariant T on FieldTransform — relax at the call boundary.
  opts: BaseFieldOpts<any>,
  meta: FieldMeta,
): Schema.Schema.Any => {
  const full: FieldMeta = { ...meta, ...pickCommon(opts) };
  if (opts.localized) {
    // Wide form accepts any string key — `defineConfig` later replaces the
    // wrap with a `Schema.Literal(...locales)`-keyed Record that strictly
    // requires the project's selected locales.
    return Schema.Record({ key: Schema.String, value: inner }).pipe(
      Schema.annotations({ [VoilaField]: full, [VoilaInner]: inner }),
    );
  }
  return inner.pipe(Schema.annotations({ [VoilaField]: full }));
};
