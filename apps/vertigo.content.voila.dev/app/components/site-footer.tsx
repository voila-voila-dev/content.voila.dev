// The colophon. Four hairline columns of the same `settings` singleton the
// admin edits — change the address in the CMS and it changes here.

import { Link } from "@tanstack/react-router";
import { langSearch, strings } from "../lib/i18n";
import type { SiteSettings } from "../lib/queries";
import { useLang } from "../lib/use-lang";
import { Eyebrow } from "./primitives";

export function SiteFooter({ settings }: { settings: SiteSettings | null }) {
  const lang = useLang();
  const t = strings(lang);

  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto max-w-[80rem] px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Eyebrow className="mb-3">{t.address}</Eyebrow>
            <p className="whitespace-pre-line text-sm leading-relaxed text-dim">
              {settings?.address ?? "Rua da Rosa 271, 1200-385 Lisboa"}
            </p>
          </div>
          <div>
            <Eyebrow className="mb-3">{t.openingHours}</Eyebrow>
            <p className="whitespace-pre-line text-sm leading-relaxed text-dim">
              {settings?.openingHours ?? "—"}
            </p>
          </div>
          <div>
            <Eyebrow className="mb-3">{t.contact}</Eyebrow>
            <ul className="space-y-1.5 text-sm text-dim">
              {settings?.contactEmail ? (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="transition-colors hover:text-(--accent)"
                  >
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              {settings?.instagram ? (
                <li>
                  <a
                    href={settings.instagram}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition-colors hover:text-(--accent)"
                  >
                    Instagram
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          <div>
            <Eyebrow className="mb-3">{t.programme}</Eyebrow>
            <ul className="space-y-1.5 text-sm text-dim">
              <li>
                <Link
                  to="/programme"
                  search={langSearch(lang)}
                  className="transition-colors hover:text-(--accent)"
                >
                  {t.allScreenings}
                </Link>
              </li>
              <li>
                <Link
                  to="/films"
                  search={langSearch(lang)}
                  className="transition-colors hover:text-(--accent)"
                >
                  {t.allFilms}
                </Link>
              </li>
              <li>
                <Link
                  to="/visit"
                  search={langSearch(lang)}
                  className="transition-colors hover:text-(--accent)"
                >
                  {t.findUs}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-faint">
            © {new Date().getFullYear()} {settings?.siteName ?? "Cinéma Vertigo"}
          </p>
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-faint">{t.poweredBy}</p>
        </div>
      </div>
    </footer>
  );
}
