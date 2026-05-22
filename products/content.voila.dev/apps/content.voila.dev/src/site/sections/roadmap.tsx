import { CheckCircleIcon, CircleIcon, CircleNotchIcon } from "@voila/ui/icons";

import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

type Status = "done" | "wip" | "planned";

const MILESTONES: {
  milestone: string;
  tagline: string;
  items: { status: Status; label: string }[];
}[] = [
  {
    milestone: "M0 — Foundations",
    tagline: "Shipped",
    items: [
      { status: "done", label: "Monorepo + design tokens" },
      { status: "done", label: "Schema + Drizzle adapters (D1 / Postgres / SQLite)" },
      { status: "done", label: "Tailwind v4 design system (@voila/ui)" },
      { status: "done", label: "Storybook on Cloudflare Workers" },
    ],
  },
  {
    milestone: "M1 — Admin & API",
    tagline: "In progress",
    items: [
      { status: "wip", label: "Admin SPA (TanStack Router + TanStack DB)" },
      { status: "wip", label: "Schema-driven REST + RPC API" },
      { status: "wip", label: "Better Auth (magic-link + GitHub OAuth)" },
      { status: "planned", label: "Field-level RBAC" },
    ],
  },
  {
    milestone: "M2 — Production-ready",
    tagline: "Planned",
    items: [
      { status: "planned", label: "Drafts, versions, scheduled publish" },
      { status: "planned", label: "Media transforms via Cloudflare Images" },
      { status: "planned", label: "i18n with Paraglide" },
      { status: "planned", label: "MCP server" },
      { status: "planned", label: "Hosted playground" },
    ],
  },
];

export function RoadmapSection() {
  return (
    <Section id="roadmap">
      <SectionEyebrow>Roadmap</SectionEyebrow>
      <SectionHeading>Where we're shipping next.</SectionHeading>
      <SectionLead>
        Public alpha. Some pieces are there, others are coming. The whole roadmap lives in the repo
        — feedback and PRs welcome.
      </SectionLead>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {MILESTONES.map((m) => (
          <div
            key={m.milestone}
            className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/60 p-6"
          >
            <div>
              <h3 className="font-mono text-sm font-semibold text-foreground">{m.milestone}</h3>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.tagline}</p>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {m.items.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <StatusIcon status={item.status} />
                  <span
                    className={
                      item.status === "done"
                        ? "text-muted-foreground line-through decoration-muted-foreground/40"
                        : "text-foreground"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") {
    return <CheckCircleIcon weight="fill" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />;
  }
  if (status === "wip") {
    return <CircleNotchIcon className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />;
  }
  return <CircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
}
