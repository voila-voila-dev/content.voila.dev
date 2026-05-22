import { Separator } from "@voila/ui";
import { GithubLogoIcon, XLogoIcon } from "@voila/ui/icons";

import { SITE } from "#/site/config";
import { Logo } from "#/site/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#how-it-works", label: "How it works" },
      { href: "#architecture", label: "Architecture" },
      { href: "#roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: SITE.docs, label: "Documentation" },
      {
        href: `${SITE.github}/tree/main/products/content.voila.dev/docs/requirements`,
        label: "Design docs",
      },
      { href: `${SITE.github}/releases`, label: "Releases" },
      { href: `${SITE.github}/blob/main/.changeset`, label: "Changelog" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: SITE.github, label: "GitHub" },
      { href: `${SITE.github}/discussions`, label: "Discussions" },
      { href: `${SITE.github}/issues`, label: "Issues" },
      { href: `${SITE.github}/blob/main/CONTRIBUTING.md`, label: "Contributing" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: `${SITE.github}/blob/main/LICENSE`, label: "MIT License" },
      { href: `${SITE.github}/security/policy`, label: "Security" },
      { href: `${SITE.github}/blob/main/CODE_OF_CONDUCT.md`, label: "Code of conduct" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              An open-source headless CMS that disappears into your TanStack Start app.
              MIT-licensed. Run it on Cloudflare. Run it anywhere.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={SITE.github}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="GitHub"
                className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <GithubLogoIcon weight="fill" className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/voila_dev"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="X"
                className="rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <XLogoIcon weight="fill" className="h-4 w-4" />
              </a>
            </div>
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                {column.title}
              </h3>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noreferrer noopener" : undefined}
                      className="transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-start justify-between gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} Voila. Released under the{" "}
            <a
              href={`${SITE.github}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              MIT License
            </a>
            .
          </p>
          <p className="font-mono">Made with TanStack Start, deployed on Cloudflare Workers.</p>
        </div>
      </div>
    </footer>
  );
}
