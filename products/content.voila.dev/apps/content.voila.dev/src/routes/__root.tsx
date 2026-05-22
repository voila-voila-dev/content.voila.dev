import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import appCss from "../styles.css?url";

const SITE_URL = "https://content.voila.dev";
const SITE_TITLE =
  "content.voila.dev — A headless CMS that disappears into your TanStack Start app";
const SITE_DESCRIPTION =
  "Open-source, TanStack-native headless CMS. One config file, one route mount, full admin UI, REST + MCP, edge-deployable on Cloudflare. MIT-licensed, no SaaS tier.";
const OG_IMAGE = `${SITE_URL}/og.png`;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "content.voila.dev",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web, Cloudflare Workers, Node.js, Bun",
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  license: "https://opensource.org/licenses/MIT",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Organization", name: "Voila", url: "https://voila.dev" },
  sameAs: ["https://github.com/voila-dev/content.voila.dev"],
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0f" },
      { name: "color-scheme", content: "dark" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      {
        name: "keywords",
        content: [
          "headless CMS",
          "TanStack",
          "TanStack Start",
          "Cloudflare Workers",
          "open source CMS",
          "React CMS",
          "Drizzle",
          "edge CMS",
          "MCP",
          "Better Auth",
          "shadcn",
          "TypeScript",
        ].join(", "),
      },
      { name: "author", content: "Voila" },
      { name: "robots", content: "index,follow,max-image-preview:large" },

      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "content.voila.dev" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "content.voila.dev — TanStack-native headless CMS" },
      { property: "og:locale", content: "en_US" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
      { name: "twitter:site", content: "@voila_dev" },
      { name: "twitter:creator", content: "@voila_dev" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: SITE_URL },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/logo192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(STRUCTURED_DATA),
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        {children}
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
