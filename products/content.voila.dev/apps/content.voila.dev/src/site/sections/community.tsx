import { Button } from "@voila/ui";
import { BookOpenIcon, ChatCircleDotsIcon, GitForkIcon, GithubLogoIcon } from "@voila/ui/icons";

import { SITE } from "#/site/config";
import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

const STATS = [
  { label: "License", value: "MIT" },
  { label: "Status", value: "Public alpha" },
  { label: "Runtime", value: "Bun · Node · Workers" },
  { label: "Languages", value: "TS, all the way down" },
];

const LINKS = [
  {
    Icon: GithubLogoIcon,
    title: "Star the repo",
    desc: "The most concrete signal that the project should keep getting time on the calendar.",
    href: SITE.github,
    cta: "Star on GitHub",
  },
  {
    Icon: ChatCircleDotsIcon,
    title: "Join the discussion",
    desc: "Schema feedback, deployment war stories, RFCs — all happen in GitHub Discussions.",
    href: `${SITE.github}/discussions`,
    cta: "Open Discussions",
  },
  {
    Icon: GitForkIcon,
    title: "Send a PR",
    desc: "Adapters, field types, docs fixes. Read the contributing guide and pick a 'good first issue'.",
    href: `${SITE.github}/blob/main/CONTRIBUTING.md`,
    cta: "Contribute",
  },
  {
    Icon: BookOpenIcon,
    title: "Read the design docs",
    desc: "13 documents covering philosophy, schema, theming, MCP and deployment. The why before the what.",
    href: `${SITE.github}/tree/main/products/content.voila.dev/docs/requirements`,
    cta: "Browse docs",
  },
];

export function CommunitySection() {
  return (
    <Section id="community">
      <SectionEyebrow>Community</SectionEyebrow>
      <SectionHeading>Open source, in the open.</SectionHeading>
      <SectionLead>
        Built in public, MIT-licensed, no SaaS upsell. Follow along, file issues, send PRs — the
        project gets better the more people kick the tires.
      </SectionLead>

      <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {LINKS.map((link) => (
          <div
            key={link.href}
            className="flex flex-col justify-between gap-4 rounded-xl border border-border/60 bg-card/60 p-6"
          >
            <div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background text-primary">
                <link.Icon weight="duotone" className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{link.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{link.desc}</p>
            </div>
            <Button
              variant="outline"
              className="self-start"
              render={
                <a href={link.href} target="_blank" rel="noreferrer noopener">
                  {link.cta}
                </a>
              }
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
