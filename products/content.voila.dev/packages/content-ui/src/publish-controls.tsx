// PublishControls — the publish/unpublish action for a draft-enabled document,
// alongside its current status. Presentational and router-agnostic: it computes
// the publish state from the document and shows the opposite action (Publish
// when in draft, Unpublish when live/scheduled), calling the supplied callbacks.
// The host wires those to `client.<slug>.publish/unpublish`. Renders nothing for
// a document with no `status` (a non-draft collection).

import { Button } from "@voila/ui";
import type { ReactNode } from "react";
import type { Doc } from "./lib/doc";
import { publishStatus } from "./lib/publish-status";
import { StatusBadge } from "./widgets/status-badge";

export interface PublishControlsProps {
  readonly doc: Doc;
  readonly onPublish: () => void | Promise<void>;
  readonly onUnpublish: () => void | Promise<void>;
  /** Disable the action (e.g. while a request is in flight). */
  readonly disabled?: boolean;
  /** Reference time for the scheduled/published split; defaults to now. */
  readonly now?: number;
}

export function PublishControls({
  doc,
  onPublish,
  onUnpublish,
  disabled = false,
  now,
}: PublishControlsProps): ReactNode {
  const state = publishStatus(doc, now);
  if (state === null) return null;

  const isLive = state === "published" || state === "scheduled";

  return (
    <div className="flex items-center gap-3">
      <StatusBadge doc={doc} now={now} />
      {isLive ? (
        <Button variant="outline" disabled={disabled} onClick={() => onUnpublish()}>
          Unpublish
        </Button>
      ) : (
        <Button disabled={disabled} onClick={() => onPublish()}>
          Publish
        </Button>
      )}
    </div>
  );
}
