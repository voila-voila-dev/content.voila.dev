// Type-only brand for "this schema is a localized field". The runtime value
// never carries the symbol — it's a phantom property the resolver uses to
// detect which fields need their record-key narrowed to the project's
// selected locales at `defineConfig` time.

import type { Schema } from "effect";
import type { Locale } from "./_locale";

declare const LocalizedBrand: unique symbol;

export interface LocalizedMarker<T> {
  readonly [LocalizedBrand]: T;
}

/**
 * Field-level type returned by every `fields.*({ localized: true })` call:
 * a wide, partial `Record<Locale, T>` shape (any subset of BCP 47 tags is
 * accepted pre-resolution) plus the brand. `defineConfig` walks branded
 * fields and re-shapes them to a strict record requiring the project's
 * selected locales.
 */
export type Localized<T> = Schema.Schema<{ readonly [K in Locale]?: T }> & LocalizedMarker<T>;

/**
 * Replace a localized field with one keyed by `L` (the project's selected
 * locales). Non-localized fields pass through unchanged.
 */
export type NarrowField<F, L extends Locale> =
  F extends LocalizedMarker<infer T> ? Schema.Schema<{ readonly [K in L]: T }> : F;

export type NarrowFields<FM, L extends Locale> = {
  readonly [K in keyof FM]: NarrowField<FM[K], L>;
};
