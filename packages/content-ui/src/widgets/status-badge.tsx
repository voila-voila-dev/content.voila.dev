// StatusBadge — shows a draft-enabled document's publish state (Draft /
// Published / Scheduled) as a `@voila.dev/ui` Badge. Renders nothing for a document
// with no `status` (a non-draft collection), so it's safe to drop into a row or
// a detail header unconditionally.

import { Badge } from "@voila.dev/ui/badge";
import type { ReactNode } from "react";
import type { Doc } from "../lib/doc";
import { useMessages } from "../lib/messages";
import { type PublishState, publishStatus } from "../lib/publish-status";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const PRESENTATION: Record<
  PublishState,
  {
    readonly label: "statusDraft" | "statusPublished" | "statusScheduled";
    readonly variant: BadgeVariant;
  }
> = {
  draft: { label: "statusDraft", variant: "secondary" },
  published: { label: "statusPublished", variant: "default" },
  scheduled: { label: "statusScheduled", variant: "outline" },
};

export interface StatusBadgeProps {
  readonly doc: Doc;
  /** Reference time for the scheduled/published split; defaults to now. */
  readonly now?: number;
}

export function StatusBadge({ doc, now }: StatusBadgeProps): ReactNode {
  const m = useMessages().shell;
  const state = publishStatus(doc, now);
  if (state === null) return null;
  const { label, variant } = PRESENTATION[state];
  return (
    <Badge data-slot="status-badge" variant={variant}>
      {m[label]}
    </Badge>
  );
}
