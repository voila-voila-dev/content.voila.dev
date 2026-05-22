import { Button, Separator, Sheet } from "@voila/ui";
import { GithubLogoIcon, ListIcon } from "@voila/ui/icons";
import { useState } from "react";

import { NAV_LINKS, SITE } from "#/site/config";
import { Logo } from "#/site/logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2" aria-label={`${SITE.name} home`}>
          <Logo />
        </a>

        <nav aria-label="Main navigation" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1 text-sm text-muted-foreground">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-md px-3 py-2 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            render={
              <a
                href={SITE.github}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Star on GitHub"
              >
                <GithubLogoIcon weight="fill" className="h-4 w-4" />
                <span className="hidden lg:inline">Star on GitHub</span>
                <span className="lg:hidden">GitHub</span>
              </a>
            }
          />
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            render={<a href="#get-started">Get started</a>}
          />

          <Sheet.Root open={open} onOpenChange={setOpen}>
            <Sheet.Trigger
              render={
                <button
                  type="button"
                  aria-label="Open menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground md:hidden"
                >
                  <ListIcon className="h-5 w-5" />
                </button>
              }
            />
            <Sheet.Content side="right" className="flex w-72 flex-col gap-6 p-6">
              <Sheet.Title>
                <Logo />
              </Sheet.Title>
              <Sheet.Description className="sr-only">Site navigation</Sheet.Description>
              <Separator />
              <nav aria-label="Mobile navigation">
                <ul className="flex flex-col gap-1 text-base">
                  {NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <Separator />
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    window.location.hash = "#get-started";
                  }}
                >
                  Get started
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  render={
                    <a href={SITE.github} target="_blank" rel="noreferrer noopener">
                      <GithubLogoIcon weight="fill" className="h-4 w-4" />
                      Star on GitHub
                    </a>
                  }
                />
              </div>
            </Sheet.Content>
          </Sheet.Root>
        </div>
      </div>
    </header>
  );
}
