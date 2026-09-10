// The document. Owns the `?lang` search parameter for the whole tree, loads the
// `settings` singleton once (header, footer and the accent colour all come from
// it), links the two typefaces, and paints the shell.

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { isLang, type Lang, strings } from "../lib/i18n";
import { fetchSite, type SiteSettings } from "../lib/queries";
import { useLang } from "../lib/use-lang";
import appCss from "../styles.css?url";

// A projector beam as a mark: a bright wedge opening out of a dark ground.
const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20fill='%230b0a09'/%3E%3Cpath%20d='M7%2016l18-9v18z'%20fill='%23d64933'/%3E%3C/svg%3E";

// Bodoni Moda (display) + Inter (text). Variable axes only — two files, no
// weight-by-weight requests.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Inter:wght@300..600&display=swap";

interface RootSearch {
  readonly lang?: Lang;
}

export const Route = createRootRoute({
  // One search parameter for the whole site. The default locale is left out of
  // the URL, so `/programme` and `/programme?lang=pt-PT` are the two forms.
  validateSearch: (search: Record<string, unknown>): RootSearch =>
    isLang(search.lang) && search.lang !== "en-US" ? { lang: search.lang } : {},
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchSite({ data: { lang: deps.lang } }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0b0a09" },
      { title: "Cinéma Vertigo — Lisboa" },
      {
        name: "description",
        content:
          "An independent repertory cinema in Lisbon: restored classics and new arthouse across two screens and the esplanade.",
      },
    ],
    links: [
      { rel: "icon", href: FAVICON },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONTS },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const settings = Route.useLoaderData().settings;
  return (
    <RootDocument settings={settings}>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({
  children,
  settings,
}: {
  children: ReactNode;
  settings: SiteSettings | null;
}) {
  const lang = useLang();
  const t = strings(lang);
  // The editor's colour, straight from the CMS, as the one accent token the
  // whole site reads (`text-(--accent)`, `border-(--accent)`, …).
  const accent = { "--accent": settings?.primaryColor ?? "#d64933" } as CSSProperties;

  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body className="film-grain" style={accent}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-(--accent) focus:bg-ground focus:px-4 focus:py-2 focus:text-sm"
        >
          {t.skipToContent}
        </a>
        <SiteHeader settings={settings} />
        <main id="main" className="mx-auto min-h-[60svh] w-full max-w-[80rem] px-5 sm:px-8">
          {children}
        </main>
        <SiteFooter settings={settings} />
        <Scripts />
      </body>
    </html>
  );
}

/** 404 — in the house's own voice, with the way back. */
function NotFound() {
  const lang = useLang();
  const t = strings(lang);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <section className="py-24 sm:py-36">
      <p className="font-display text-[clamp(5rem,18vw,11rem)] leading-none text-(--accent)">404</p>
      <h1 className="mt-6 font-display text-[clamp(2rem,5vw,3.2rem)] leading-tight">
        {t.notFoundTitle}
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-dim">{t.notFoundBody}</p>
      <p className="mt-3 font-mono text-xs text-faint">{pathname}</p>
      <a
        href={lang === "en-US" ? "/" : `/?lang=${lang}`}
        className="mt-10 inline-block border border-(--accent) px-5 py-2.5 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-(--accent) transition-colors hover:bg-(--accent) hover:text-[#0b0a09]"
      >
        {t.backHome}
      </a>
    </section>
  );
}
