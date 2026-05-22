import { Accordion } from "@voila/ui";

import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

const FAQS = [
  {
    q: "Is content.voila.dev a hosted service?",
    a: "No. It's a library you import into your TanStack Start app and mount on a route. There's no SaaS tier, no seat pricing, and no hosted database. You run it on your own Cloudflare / Node / Bun infrastructure and pay them, not us.",
  },
  {
    q: "Do I have to use TanStack Start?",
    a: "Yes. The whole project is built around being a TanStack Start library, not a standalone server. That means we get routing, RPC, SSR, and the Cloudflare adapter for free — and you get type-sharing between your public site and the admin without codegen.",
  },
  {
    q: "Do I have to deploy to Cloudflare?",
    a: "No. Cloudflare is the happy path (Workers + D1 + R2 + Queues), but every edge-coupled concern is behind an adapter. Postgres works. S3 works. Node + a long-running worker works. We just optimize the docs and templates for the path that's cheapest for small projects.",
  },
  {
    q: "How is this different from Payload or Sanity?",
    a: "Payload runs as its own Node server next to your app. Sanity is a hosted SaaS where the source of truth is their studio. Both work — they just chose a different shape. We're optimizing for 'this CMS is a feature of your TanStack Start app, with one route mount, one config file, and your schema in your repo'.",
  },
  {
    q: "Why MCP?",
    a: "Because LLM agents are now a real consumer of your CMS. Your schema already encodes everything an agent needs (types, validators, RBAC), so we expose it as a typed MCP server for free — same RBAC as the REST API, no extra wiring.",
  },
  {
    q: "Is the admin UI customizable?",
    a: "Yes. Custom widgets, custom field types, custom pages, sidebar panels, row buttons, bulk actions, background tasks, and crons are all first-class — you register them in `content.config.ts`, you don't fork the CMS. The admin itself uses shadcn-style primitives over Base UI with Tailwind v4 design tokens, so theming is a CSS variable override.",
  },
  {
    q: "When can I try the playground?",
    a: "The hosted playground (a demo admin + demo site you can poke at without installing anything) is on the M2 milestone. Until then, `bunx create-voila@latest my-site` is the fastest way to see it running locally.",
  },
  {
    q: "Can I sponsor the project?",
    a: "Please do. Sponsor tiers go live with M1; in the meantime get in touch via GitHub Discussions or open a sponsorship issue. Logo placement, roadmap input, and direct maintainer access are all on the table.",
  },
];

export function FaqSection() {
  return (
    <Section id="faq">
      <SectionEyebrow>FAQ</SectionEyebrow>
      <SectionHeading>Questions worth answering up front.</SectionHeading>
      <SectionLead>
        Didn't find what you're looking for? Open a thread in GitHub Discussions — we'll mirror the
        answer back here.
      </SectionLead>

      <Accordion.Root className="mt-12 overflow-hidden rounded-xl border border-border/60 bg-card/60">
        {FAQS.map((item, i) => (
          <Accordion.Item
            key={item.q}
            value={`faq-${i}`}
            className="border-border/60 px-6 last:border-b-0"
          >
            <Accordion.Trigger className="text-left text-base font-medium hover:no-underline">
              {item.q}
            </Accordion.Trigger>
            <Accordion.Content className="text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </Section>
  );
}
