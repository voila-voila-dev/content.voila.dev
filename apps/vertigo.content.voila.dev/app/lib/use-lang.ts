// The current language, read off the root route's `?lang` search param.
//
// `strict: false` means any component in the tree can ask without naming the
// route it happens to be rendered under — the param is declared once, on the
// root route, and inherited everywhere.

import { useSearch } from "@tanstack/react-router";
import { DEFAULT_LOCALE, isLang, type Lang } from "./i18n";

export function useLang(): Lang {
  const search = useSearch({ strict: false }) as { lang?: unknown };
  return isLang(search.lang) ? search.lang : DEFAULT_LOCALE;
}
