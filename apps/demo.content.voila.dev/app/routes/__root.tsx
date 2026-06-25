import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AdminProvider } from "@voila/content-admin";
import { themeInitScript } from "@voila/content-ui";
// maplibre-gl's stylesheet for the admin's Map view (controls, markers, popups).
// Loaded as a URL + <link> like appCss — a stylesheet, never on the dynamic JS
// path, so it doesn't affect SSR (`MapView` lazy-loads the maplibre JS itself).
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { type ReactNode, useState } from "react";
import { admin } from "../lib/admin";
import appCss from "../styles.css?url";

const faviconHref =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='7'%20fill='%230b0b0c'/%3E%3Cpath%20d='M8%209l8%2015%208-15'%20fill='none'%20stroke='%23fafafa'%20stroke-width='3'%20stroke-linecap='round'%20stroke-linejoin='round'/%3E%3C/svg%3E";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: maplibreCss },
      { rel: "icon", href: faviconHref, type: "image/svg+xml" },
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
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static engine-owned script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/* `AdminProvider` shares the admin instance with every screen — including
            the login page, which sits outside the root guard. */}
        <QueryClientProvider client={queryClient}>
          <AdminProvider admin={admin}>{children}</AdminProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
