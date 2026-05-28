import type { Locale } from "./fields/_locale";

/**
 * i18n selection. `locales` is a tuple of BCP 47 tags from the canonical
 * `Locale` union; `defaultLocale` and every fallback entry are constrained
 * to that tuple, so a typo in one place lights up the whole graph.
 */
export interface I18nConfig<Locales extends ReadonlyArray<Locale> = ReadonlyArray<Locale>> {
  readonly locales: Locales;
  readonly defaultLocale: Locales[number];
  readonly fallback?: { readonly [K in Locales[number]]?: ReadonlyArray<Locales[number]> };
}
