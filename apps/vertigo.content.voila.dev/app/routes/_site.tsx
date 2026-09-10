// The PUBLIC site's shell — a pathless layout, so it adds no URL segment: `/`,
// `/programme`, `/films/…` all render inside it, and `/admin` does not. It owns
// everything that used to sit on the root route: the `settings` singleton (the
// header, the footer and the accent colour all come from it), the typefaces, the
// public stylesheet, and the 404 in the house's own voice.
//
// Keeping this off the root is what lets the admin live in the same app: the two
// halves ship different stylesheets and different chrome, and a page must get
// exactly one of each.

import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { NotFound } from "../components/not-found";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { type Lang, strings } from "../lib/i18n";
import { fetchSite } from "../lib/queries";
import { useLang } from "../lib/use-lang";
import appCss from "../styles.css?url";

// A projector beam as a mark: a bright wedge opening out of a dark ground.
const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20fill='%230b0a09'/%3E%3Cpath%20d='M7%2016l18-9v18z'%20fill='%23d64933'/%3E%3C/svg%3E";

// Bodoni Moda (display) + Inter (text). Variable axes only — two files, no
// weight-by-weight requests.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&family=Inter:wght@300..600&display=swap";

export const Route = createFileRoute("/_site")({
  loaderDeps: ({ search }) => ({ lang: search.lang ?? ("en-US" as Lang) }),
  loader: ({ deps }) => fetchSite({ data: { lang: deps.lang } }),
  head: () => ({
    meta: [
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
  component: SiteLayout,
  notFoundComponent: SiteNotFound,
});

function SiteLayout() {
  return (
    <SiteShell>
      <Outlet />
    </SiteShell>
  );
}

/**
 * The 404 replaces this layout's component rather than rendering inside it, so
 * it has to put the shell back itself — otherwise a mistyped URL loses the
 * header, the footer and the way home.
 */
function SiteNotFound() {
  return (
    <SiteShell>
      <NotFound />
    </SiteShell>
  );
}

function SiteShell({ children }: { children: ReactNode }) {
  const settings = Route.useLoaderData()?.settings ?? null;
  const lang = useLang();
  const t = strings(lang);
  // The editor's colour, straight from the CMS, as the one accent token the
  // whole site reads (`text-(--accent)`, `border-(--accent)`, …).
  const accent = { "--accent": settings?.primaryColor ?? "#d64933" } as CSSProperties;

  return (
    <div className="film-grain" style={accent}>
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
    </div>
  );
}
