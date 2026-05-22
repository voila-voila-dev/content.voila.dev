import { CheckIcon, MinusIcon } from "@voila/ui/icons";

import { Section, SectionEyebrow, SectionHeading, SectionLead } from "#/site/section";

type Row = {
  label: string;
  voila: string | true;
  sanity: string | boolean;
  payload: string | boolean;
};

const ROWS: Row[] = [
  {
    label: "Source of truth",
    voila: "Your schema, in your repo",
    sanity: "Hosted studio",
    payload: "Config file",
  },
  {
    label: "Where it runs",
    voila: "Your TanStack Start app",
    sanity: "Sanity cloud",
    payload: "Your Node server",
  },
  {
    label: "Edge deploy",
    voila: "Cloudflare Workers, first-class",
    sanity: "Hosted only",
    payload: "Experimental",
  },
  {
    label: "Typed client",
    voila: "Inferred, no codegen",
    sanity: "Generated SDK",
    payload: "Generated types",
  },
  { label: "MCP for agents", voila: true, sanity: false, payload: false },
  {
    label: "Pricing",
    voila: "MIT, free forever",
    sanity: "Free tier, then $$$",
    payload: "Free, paid cloud add-ons",
  },
  { label: "Vendor lock-in", voila: "None", sanity: "High", payload: "Low" },
];

export function ComparisonSection() {
  return (
    <Section id="comparison">
      <SectionEyebrow>Comparison</SectionEyebrow>
      <SectionHeading>How does it compare?</SectionHeading>
      <SectionLead>
        Headless CMSes are either SaaS-first (you rent your data) or library-first (you wire
        everything). <strong className="text-foreground">content.voila.dev</strong> is library-first
        with batteries included.
      </SectionLead>

      <div className="mt-12 overflow-x-auto rounded-xl border border-border/60 bg-card/60">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Concern</th>
              <th className="px-4 py-3 font-medium text-primary">content.voila.dev</th>
              <th className="px-4 py-3 font-medium">Sanity</th>
              <th className="px-4 py-3 font-medium">Payload</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? "bg-background/40" : undefined}>
                <td className="px-4 py-3 font-medium text-foreground">{row.label}</td>
                <Cell value={row.voila} accent />
                <Cell value={row.sanity} />
                <Cell value={row.payload} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        We pick the comparisons we lose, too. See the{" "}
        <a className="underline-offset-4 hover:text-foreground hover:underline" href="#roadmap">
          roadmap
        </a>{" "}
        for what's still missing.
      </p>
    </Section>
  );
}

function Cell({ value, accent = false }: { value: string | boolean; accent?: boolean }) {
  if (typeof value === "boolean") {
    return (
      <td className="px-4 py-3">
        {value ? (
          <CheckIcon
            className={accent ? "h-4 w-4 text-primary" : "h-4 w-4 text-accent"}
            weight="bold"
          />
        ) : (
          <MinusIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </td>
    );
  }
  return (
    <td className={accent ? "px-4 py-3 text-foreground" : "px-4 py-3 text-muted-foreground"}>
      {value}
    </td>
  );
}
