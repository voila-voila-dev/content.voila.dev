// StatCard — a single dashboard metric: a label, a prominent value, and an
// optional description and icon, over the `@voila/ui` Card. Generic (not tied to
// a config) so it's reusable for any number. When `href` is set the whole card
// becomes a link; like the rest of content-ui it's router-agnostic — pass
// `renderLink` to render through a framework `Link` (it receives the href and
// the card body as children), defaulting to a plain `<a>`.

import { Card } from "@voila/ui/card";
import type { ReactElement, ReactNode } from "react";

export interface StatCardProps {
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly description?: ReactNode;
  readonly icon?: ReactNode;
  /** When set, the card is a link to this href. */
  readonly href?: string;
  /** Render the link element. Defaults to a plain `<a href>`. */
  readonly renderLink?: (href: string, children: ReactNode) => ReactElement;
}

function defaultRenderLink(href: string, children: ReactNode): ReactElement {
  return (
    <a href={href} className="block">
      {children}
    </a>
  );
}

export function StatCard({
  label,
  value,
  description,
  icon,
  href,
  renderLink = defaultRenderLink,
}: StatCardProps): ReactNode {
  const card = (
    <Card.Root
      data-slot="stat-card"
      className={href ? "transition-colors hover:bg-accent/50" : undefined}
    >
      <Card.Header.Root className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <Card.Header.Title className="text-sm font-medium text-muted-foreground">
          {label}
        </Card.Header.Title>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </Card.Header.Root>
      <Card.Content>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </Card.Content>
    </Card.Root>
  );

  return href ? renderLink(href, card) : card;
}
