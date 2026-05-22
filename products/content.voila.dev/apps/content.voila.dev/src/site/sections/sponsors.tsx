import { Button } from "@voila/ui";
import { GithubLogoIcon, HeartIcon } from "@voila/ui/icons";

import { SITE } from "#/site/config";
import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

const WISHLIST = [
  { name: "Cloudflare", reason: "Workers · D1 · R2 · Queues" },
  { name: "TanStack", reason: "The whole stack we sit on" },
  { name: "Vercel", reason: "Help us nail the Node adapter" },
  { name: "Bun", reason: "Runtime · workspaces · test runner" },
  { name: "Drizzle", reason: "Schema-driven migrations" },
  { name: "Phosphor", reason: "Icons across the admin" },
];

export function SponsorsSection() {
  return (
    <Section id="sponsors">
      <SectionEyebrow>Sponsorship</SectionEyebrow>
      <SectionHeading>Open source thrives with sponsors.</SectionHeading>
      <SectionLead>
        We're MIT-licensed and self-fund the work today. If your platform powers
        <strong className="text-foreground"> content.voila.dev</strong>, partnering with us puts
        your name in front of every developer who scaffolds the project.
      </SectionLead>

      <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/60 to-accent/10 p-6">
          <div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-background text-primary">
              <HeartIcon weight="duotone" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-xl font-semibold">Become a sponsor</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Logo placement here and on the docs, a roadmap shoutout on every release, and a direct
              line to the maintainers. Sponsor tiers go live with M1.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="w-full gap-2"
              render={
                <a
                  href={`${SITE.github}/blob/main/SPONSORS.md`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <HeartIcon weight="fill" className="h-4 w-4" />
                  Sponsor us
                </a>
              }
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              render={
                <a
                  href={`${SITE.github}/discussions/categories/sponsors`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <GithubLogoIcon weight="fill" className="h-4 w-4" />
                  Get in touch
                </a>
              }
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Platforms we'd love to partner with
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {WISHLIST.map((p) => (
              <li
                key={p.name}
                className="rounded-xl border border-dashed border-border/70 bg-card/40 p-5"
              >
                <span className="font-mono text-sm font-semibold text-foreground">{p.name}</span>
                <p className="mt-1 text-xs text-muted-foreground">{p.reason}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Names listed for context — sponsorship slots are open and unfilled.
          </p>
        </div>
      </div>
    </Section>
  );
}
