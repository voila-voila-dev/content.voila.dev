import type { Locale } from "./schema/fields/_locale";

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

/**
 * The ordered locales a per-locale read tries: the requested locale, its
 * `fallback` entries, then `defaultLocale` — deduplicated, first hit wins.
 * This is the one place fallback semantics live; REST's `?locale` and any
 * host-side resolution share it.
 */
export function localeChain(i18n: I18nConfig, locale: string): ReadonlyArray<string> {
  const chain: string[] = [locale];
  const fallback = (i18n.fallback as Readonly<Record<string, ReadonlyArray<string>>> | undefined)?.[
    locale
  ];
  for (const entry of fallback ?? []) {
    if (!chain.includes(entry)) chain.push(entry);
  }
  if (!chain.includes(i18n.defaultLocale)) chain.push(i18n.defaultLocale);
  return chain;
}
