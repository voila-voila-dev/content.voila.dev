import { Card } from "@voila/ui";
import {
  ArticleIcon,
  CloudIcon,
  DatabaseIcon,
  ImagesSquareIcon,
  LightningIcon,
  PuzzlePieceIcon,
  RobotIcon,
  ShieldCheckIcon,
  StackIcon,
  TranslateIcon,
} from "@voila/ui/icons";

import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

const FEATURES = [
  {
    Icon: StackIcon,
    title: "TanStack-native",
    body: "Router, Query, Form, Table, Start server functions, Start Cloudflare adapter. If TanStack has it, we use it.",
  },
  {
    Icon: ArticleIcon,
    title: "Schema is the source of truth",
    body: "One TypeScript schema → admin UI, REST/RPC API, typed client, Drizzle migrations, MCP tools, validators.",
  },
  {
    Icon: LightningIcon,
    title: "Edge-first, portable",
    body: "Cloudflare Workers is the happy path; every binding hides behind an adapter (R2/S3, D1/Postgres/SQLite).",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Auth + RBAC included",
    body: "Better Auth with magic-link + GitHub OAuth, plus per-collection and per-field role checks out of the box.",
  },
  {
    Icon: ImagesSquareIcon,
    title: "Media that doesn't suck",
    body: "Direct-to-R2 uploads, signed URLs, image transforms via Cloudflare Images. Drafts, versions, scheduled publish.",
  },
  {
    Icon: RobotIcon,
    title: "MCP server, day one",
    body: "Your schema becomes a fully-typed MCP server. Agents can read, write, and search your content — with the same RBAC.",
  },
  {
    Icon: TranslateIcon,
    title: "i18n via Paraglide",
    body: "Type-safe message keys at compile time, per-locale content variants, market-based routing for your public site.",
  },
  {
    Icon: PuzzlePieceIcon,
    title: "Extensions, not forks",
    body: "Custom widgets, sidebar panels, row buttons, bulk actions, background tasks and crons — register them in config.",
  },
  {
    Icon: DatabaseIcon,
    title: "Drizzle migrations",
    body: "Schema changes generate Drizzle migrations automatically. Run them on D1, Postgres, SQLite — same flow everywhere.",
  },
  {
    Icon: CloudIcon,
    title: "Self-hosted, MIT, no SaaS",
    body: "No hosted tier, no seat pricing, no telemetry. You pay Cloudflare, not us. Fork it, embed it, ship it.",
  },
];

export function FeaturesSection() {
  return (
    <Section id="features">
      <SectionEyebrow>Features</SectionEyebrow>
      <SectionHeading>Everything a serious CMS ships, with none of the ceremony.</SectionHeading>
      <SectionLead>
        Day-one feature set, designed so you can move from{" "}
        <code className="font-mono">bunx create-voila</code> to production without bolting on a
        half-dozen services.
      </SectionLead>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card.Root
            key={feature.title}
            className="border-border/60 bg-card/60 transition-colors hover:border-primary/40 hover:bg-card"
          >
            <Card.Header.Root>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-primary">
                <feature.Icon weight="duotone" className="h-5 w-5" />
              </span>
              <Card.Header.Title className="pt-3 text-base">{feature.title}</Card.Header.Title>
              <Card.Header.Description className="text-sm">{feature.body}</Card.Header.Description>
            </Card.Header.Root>
          </Card.Root>
        ))}
      </div>
    </Section>
  );
}
