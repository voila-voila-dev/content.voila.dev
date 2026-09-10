// i18n — how the admin shows a localized field value. A localized field stores
// `Record<locale, T>`; the read surfaces (table cells, detail rows, card
// titles) need ONE value to show, so this resolves the record through the
// project's locale chain (display locale → its fallbacks → the default locale →
// any non-empty entry) and reports which locale won, so the UI can flag a
// fallback. The chain comes from the config's `i18n` block, shared through
// `I18nProvider` (the shell provides it) and read with `useI18n()` — every
// component stays usable without a provider (first non-empty entry wins).

import type { I18nConfig } from "@voila/content";
import { localeChain } from "@voila/content";
import { createContext, type ReactNode, useContext } from "react";

export interface I18nContextValue {
  readonly i18n?: I18nConfig;
  /** The locale the admin displays in. Defaults to `i18n.defaultLocale`. */
  readonly displayLocale?: string;
}

const I18nContext = createContext<I18nContextValue>({});

export interface I18nProviderProps extends I18nContextValue {
  readonly children?: ReactNode;
}

export function I18nProvider({ i18n, displayLocale, children }: I18nProviderProps): ReactNode {
  return <I18nContext.Provider value={{ i18n, displayLocale }}>{children}</I18nContext.Provider>;
}

/** The current i18n settings (empty outside a provider). */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export interface ResolvedLocalized {
  /** The chosen per-locale value (may still be empty when every locale is). */
  readonly value: unknown;
  /** The locale the value came from, or `undefined` when nothing matched. */
  readonly locale?: string;
  /** True when the value came from a fallback locale, not the display locale. */
  readonly fallback: boolean;
}

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** A plain object that isn't an array — the shape a localized record has. */
export function isLocalizedRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Pick the value to show from a localized record. Tries the display locale,
 * then its configured fallback chain, then any remaining locale (declaration
 * order) so a document translated in only one language still reads.
 */
export function resolveLocalized(value: unknown, ctx: I18nContextValue = {}): ResolvedLocalized {
  if (!isLocalizedRecord(value)) return { value, fallback: false };
  const display = ctx.displayLocale ?? ctx.i18n?.defaultLocale;
  const chain: string[] = [];
  if (ctx.i18n && display) chain.push(...localeChain(ctx.i18n, display));
  else if (display) chain.push(display);
  for (const locale of [...(ctx.i18n?.locales ?? []), ...Object.keys(value)]) {
    if (!chain.includes(locale)) chain.push(locale);
  }
  for (const locale of chain) {
    const candidate = value[locale];
    if (!isBlank(candidate)) {
      return { value: candidate, locale, fallback: display !== undefined && locale !== display };
    }
  }
  return { value: undefined, fallback: false };
}
