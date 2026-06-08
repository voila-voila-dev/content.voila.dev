// Type-only brand for "this field is localized". The runtime value never
// carries the brand — it's a phantom the resolver pairs with `field.meta
// .localized` + `field.inner` to decide which fields need their record key
// narrowed to the project's selected locales at `defineConfig` time.

import type { Field } from "./_base";
import type { Locale } from "./_locale";

declare const LocalizedBrand: unique symbol;

export interface LocalizedMarker<T> {
  readonly [LocalizedBrand]: T;
}

/**
 * Field-level type returned by every `fields.*({ localized: true })` call:
 * a wide, partial `Record<Locale, T>` field plus the brand. `defineConfig`
 * walks branded fields and re-shapes them to a strict record requiring the
 * project's selected locales.
 */
export type Localized<T> = Field<{ readonly [K in Locale]?: T }> & LocalizedMarker<T>;

/**
 * Replace a localized field with one keyed by `L` (the project's selected
 * locales). Non-localized fields pass through unchanged.
 */
export type NarrowField<F, L extends Locale> =
  F extends LocalizedMarker<infer T> ? Field<{ readonly [K in L]: T }> : F;

export type NarrowFields<FM, L extends Locale> = {
  readonly [K in keyof FM]: NarrowField<FM[K], L>;
};
