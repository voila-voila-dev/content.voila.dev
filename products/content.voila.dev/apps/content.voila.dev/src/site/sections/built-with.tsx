import { Section } from "#/site/section";

const STACK = [
  { name: "TanStack Start", subtitle: "Router · Query · Form · Table · DB" },
  { name: "Cloudflare", subtitle: "Workers · D1 · R2 · Queues" },
  { name: "Drizzle", subtitle: "Schema · Migrations" },
  { name: "Better Auth", subtitle: "Sessions · RBAC" },
  { name: "Base UI", subtitle: "Headless primitives" },
  { name: "Tailwind v4", subtitle: "Design tokens" },
  { name: "Phosphor", subtitle: "Icons" },
  { name: "Bun", subtitle: "Runtime · Workspaces" },
];

export function BuiltWithSection() {
  return (
    <Section className="py-12 sm:py-16">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Built on the shoulders of giants
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
        {STACK.map((tool) => (
          <li
            key={tool.name}
            className="flex flex-col items-center justify-center gap-1 text-center"
          >
            <span className="font-mono text-sm font-semibold text-foreground">{tool.name}</span>
            <span className="text-[11px] text-muted-foreground">{tool.subtitle}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
