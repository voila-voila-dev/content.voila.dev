// StatusBadge — shows a draft-enabled document's publish state (Draft /
// Published / Scheduled) as a `@voila/ui` Badge. Renders nothing for a document
// with no `status` (a non-draft collection), so it's safe to drop into a row or
// a detail header unconditionally.

import { Badge } from "@voila/ui/badge";
import type { ReactNode } from "react";
import type { Doc } from "../lib/doc";
import { type PublishState, publishStatus } from "../lib/publish-status";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const PRESENTATION: Record<
  PublishState,
  { readonly label: string; readonly variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  scheduled: { label: "Scheduled", variant: "outline" },
};

export interface StatusBadgeProps {
  readonly doc: Doc;
  /** Reference time for the scheduled/published split; defaults to now. */
  readonly now?: number;
}

export function StatusBadge({ doc, now }: StatusBadgeProps): ReactNode {
  const state = publishStatus(doc, now);
  if (state === null) return null;
  const { label, variant } = PRESENTATION[state];
  return (
    <Badge data-slot="status-badge" variant={variant}>
      {label}
    </Badge>
  );
}
