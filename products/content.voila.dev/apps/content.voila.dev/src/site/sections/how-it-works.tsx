import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

const STEPS = [
  {
    n: "01",
    title: "Scaffold or add",
    desc: "Use the template for a fresh project, or run `voila init` inside an existing TanStack Start app to patch it in place.",
    code: "bunx create-voila@latest my-site",
  },
  {
    n: "02",
    title: "Define your content",
    desc: "Write one schema in `content.config.ts`. Fields become forms, columns, validators, migrations, and API endpoints.",
    code: "fields.string({ required: true, max: 120 })",
  },
  {
    n: "03",
    title: "Mount one route",
    desc: "A single catch-all at `/admin/$.ts` exposes the admin SPA, REST API, and MCP server. Nothing else to wire up.",
    code: "content.handle(request)",
  },
  {
    n: "04",
    title: "Ship to the edge",
    desc: "`bun run deploy` pushes to Cloudflare Workers with D1 + R2 bindings — same code, same types, same UI.",
    code: "wrangler deploy",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works">
      <SectionEyebrow>How it works</SectionEyebrow>
      <SectionHeading>From zero to a typed CMS in four steps.</SectionHeading>
      <SectionLead>
        No metaprogramming. No install-time codegen. No "framework inside a framework". If you can{" "}
        <code className="font-mono">defineRoute</code>, you can self-host a CMS.
      </SectionLead>

      <ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-6"
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Step {step.n}
            </span>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.desc}</p>
            <pre className="mt-auto overflow-x-auto rounded-md border border-border/80 bg-background/80 p-3 font-mono text-[11px] text-foreground">
              <code>{step.code}</code>
            </pre>
          </li>
        ))}
      </ol>
    </Section>
  );
}
