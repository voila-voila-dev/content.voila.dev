// The document, and nothing else.
//
// This app is two front ends over one database: the public cinema site under the
// `_site` layout, and its CMS under `/admin`. They have opposing chrome AND
// opposing stylesheets (each carries its own Tailwind build and token layer), so
// neither can live here — the root owns only what both halves share: the `?lang`
// search parameter, the query client the admin screens run on, and the `<html>`
// skeleton. Everything visible is contributed by a child route's `head()`.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { themeInitScript } from "@voila/content-ui";
import { type ReactNode, useState } from "react";
import { isLang, type Lang } from "../lib/i18n";
import { useLang } from "../lib/use-lang";

interface RootSearch {
  readonly lang?: Lang;
  /**
   * The admin screens own search params of their own (`?view=…`, and whatever a
   * saved view puts in the URL). The root validator is shared by both halves of
   * the app, so it must let anything else through rather than stripping it — a
   * strict schema here silently breaks `/admin`'s view tabs.
   */
  readonly [key: string]: unknown;
}

export const Route = createRootRoute({
  // One search parameter for the whole site. The default locale is left out of
  // the URL, so `/programme` and `/programme?lang=pt-PT` are the two forms.
  validateSearch: ({ lang, ...rest }: Record<string, unknown>): RootSearch =>
    isLang(lang) && lang !== "en-US" ? { ...rest, lang } : rest,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const lang = useLang();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Resolves the admin's light/dark class before first paint. Inert on the
            public pages, whose palette is fixed. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static engine-owned script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
