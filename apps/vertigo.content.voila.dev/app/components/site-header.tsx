// The masthead: wordmark, four destinations, and the language switch. Set as a
// printed programme's header would be — hairline rule, wide-tracked caps, the
// active destination marked by the house colour rather than a pill.

import { Link } from "@tanstack/react-router";
import { LOCALES, langSearch, strings } from "../lib/i18n";
import type { SiteSettings } from "../lib/queries";
import { useLang } from "../lib/use-lang";

const NAV = [
  { to: "/programme", key: "programme" },
  { to: "/films", key: "films" },
  { to: "/journal", key: "journal" },
  { to: "/visit", key: "visit" },
] as const;

const LOCALE_LABEL: Record<string, string> = { "en-US": "EN", "pt-PT": "PT" };

export function SiteHeader({ settings }: { settings: SiteSettings | null }) {
  const lang = useLang();
  const t = strings(lang);
  const search = langSearch(lang);
  const name = settings?.siteName ?? "Cinéma Vertigo";

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[80rem] flex-col gap-5 px-5 py-5 sm:px-8 md:flex-row md:items-end md:justify-between md:gap-8">
        <Link
          to="/"
          search={search}
          className="group block shrink-0"
          aria-label={`${name} — ${t.backHome}`}
        >
          <span className="block font-display text-[clamp(1.5rem,3.6vw,2.1rem)] font-medium leading-none tracking-tight">
            {name}
          </span>
          <span className="mt-2 block text-[0.6rem] font-medium uppercase tracking-[0.34em] text-faint transition-colors group-hover:text-(--accent)">
            Lisboa · Est. 1948
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 md:justify-end">
          <nav aria-label="Primary">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    search={search}
                    className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-dim transition-colors hover:text-bone"
                    activeProps={{ className: "text-(--accent)" }}
                  >
                    {t[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="flex items-center border border-rule" aria-label={t.language}>
            {LOCALES.map((locale) => (
              <Link
                key={locale}
                to="."
                search={langSearch(locale)}
                aria-current={locale === lang ? "true" : undefined}
                className={`px-2.5 py-1 text-[0.62rem] font-medium uppercase tracking-[0.18em] transition-colors ${
                  locale === lang ? "bg-(--accent) text-[#0b0a09]" : "text-faint hover:text-bone"
                }`}
              >
                {LOCALE_LABEL[locale] ?? locale}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
