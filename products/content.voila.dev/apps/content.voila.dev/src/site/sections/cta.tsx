import { Button } from "@voila/ui";
import { ArrowRightIcon, GithubLogoIcon, PlayIcon } from "@voila/ui/icons";

import { SITE } from "#/site/config";
import { CopyCommand } from "#/site/copy-command";
import { Section, SectionEyebrow, SectionHeading } from "#/site/section";

export function CtaSection() {
  return (
    <Section id="cta" className="border-b-0">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/80 to-accent/15 p-8 sm:p-12 lg:p-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative max-w-2xl">
          <SectionEyebrow>Ready when you are</SectionEyebrow>
          <SectionHeading>Spin up a typed CMS in 30 seconds.</SectionHeading>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Scaffold, define a collection, mount one route. You can deploy by the end of the same
            coffee.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <CopyCommand command={SITE.bootstrapCommand} />
            <div className="flex flex-col gap-2 sm:flex-row">
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
                title="Hosted playground coming with M2"
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
          </div>
        </div>
      </div>
    </Section>
  );
}
