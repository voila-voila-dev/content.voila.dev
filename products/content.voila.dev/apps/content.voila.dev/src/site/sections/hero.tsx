import { Badge, Button } from "@voila/ui";
import { ArrowRightIcon, GithubLogoIcon, PlayIcon, SparkleIcon } from "@voila/ui/icons";

import { SITE } from "#/site/config";
import { CopyCommand } from "#/site/copy-command";

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-border/40 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8 lg:pt-28"
    >
      {/* Decorative grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <Badge
          variant="outline"
          className="mb-6 inline-flex items-center gap-1.5 border-primary/30 bg-primary/10 text-primary"
        >
          <SparkleIcon weight="fill" className="h-3.5 w-3.5" />
          <span>Now in public alpha · MIT-licensed</span>
        </Badge>

        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
          A headless CMS that{" "}
          <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-accent bg-clip-text text-transparent">
            disappears
          </span>{" "}
          into your app.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg lg:text-xl">
          <strong className="text-foreground">content.voila.dev</strong> is a TanStack-native CMS
          you <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">import</code> and
          mount on a route. One config file. Full admin UI, REST + MCP API, edge-deploy on
          Cloudflare. No SaaS, no lock-in.
        </p>

        <div id="get-started" className="mx-auto mt-10 flex max-w-xl flex-col items-stretch gap-3">
          <CopyCommand command={SITE.bootstrapCommand} />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="gap-2"
              render={
                <a href="#how-it-works">
                  Get started <ArrowRightIcon className="h-4 w-4" />
                </a>
              }
            />
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              disabled
              aria-disabled="true"
              title="The hosted playground is not ready yet — coming soon"
            >
              <PlayIcon weight="fill" className="h-4 w-4" />
              Play with playground
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Soon
              </span>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="gap-2"
              render={
                <a href={SITE.github} target="_blank" rel="noreferrer noopener">
                  <GithubLogoIcon weight="fill" className="h-4 w-4" />
                  Star on GitHub
                </a>
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Works with Bun, Node, or pnpm. Default deploy target: Cloudflare Workers + D1 + R2.
          </p>
        </div>
      </div>
    </section>
  );
}
