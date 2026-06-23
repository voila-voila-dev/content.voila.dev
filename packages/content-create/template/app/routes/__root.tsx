import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AdminProvider } from "@voila/content-admin";
import { themeInitScript } from "@voila/content-ui";
import { type ReactNode, useState } from "react";
import { admin } from "../lib/admin";
import appCss from "../styles.css?url";

// An inline SVG favicon (data URI, no asset file): declaring a `<link rel="icon">`
// stops the browser's implicit `/favicon.ico` request — which would otherwise 404
// on every page — and ships a default mark for the admin.
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
  // One QueryClient per document. Creating it in state (rather than at module
  // scope) keeps each SSR request isolated — a server-shared client would leak
  // one visitor's cached data into the next. The admin screens read and mutate
  // content through this client with `@tanstack/react-query`.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  return (
    // The theme class is applied to <html> before hydration, hence the
    // suppressed warning. The inline script keeps a dark-mode visitor from
    // seeing a flash of the light theme on load.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static engine-owned script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/* `AdminProvider` shares the admin instance (typed client, widgets,
            screens) with every screen — including the login page, which sits
            outside the root guard. */}
        <QueryClientProvider client={queryClient}>
          <AdminProvider admin={admin}>{children}</AdminProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
