// RevisionHistory — a document's version history (revisions-enabled
// collections): one row per snapshot, newest first, with a Restore action on
// every past revision. Presentational and router-agnostic — the host fetches a
// page with the typed client (`client.<slug>.revisions(id)` → `{ data,
// nextCursor }`), passes it in, and wires `onRestore` to
// `client.<slug>.restoreRevision(id, rev)` (then refetches). The newest
// revision is the current state, so it shows a "Current" marker instead of a
// Restore button.

import { Badge, Button } from "@voila/ui";
import type { ReactNode } from "react";
import { StatusBadge } from "./widgets/status-badge";

/** One history entry, as the typed client returns it. */
export interface RevisionHistoryItem {
  readonly rev: number;
  /** Epoch-ms time the snapshot was taken. */
  readonly createdAt: number;
  readonly doc: Record<string, unknown>;
}

export interface RevisionHistoryProps {
  /** The current page of history, newest first (`client.<slug>.revisions(id).data`). */
  readonly revisions: readonly RevisionHistoryItem[];
  /** Restore a past revision; omit to render the history read-only. */
  readonly onRestore?: (rev: number) => void | Promise<void>;
  /** Disable the actions (e.g. while a restore is in flight). */
  readonly disabled?: boolean;
  readonly loading?: boolean;
  /** Block-level error message (e.g. a failed fetch). */
  readonly error?: string;
  readonly emptyMessage?: string;
  /** Opaque cursor for the next page; when set with `onLoadMore`, shows the button. */
  readonly nextCursor?: string | null;
  readonly onLoadMore?: () => void;
  readonly loadMoreLabel?: string;
  /** Reference time for the snapshot status badges; defaults to now. */
  readonly now?: number;
}

export function RevisionHistory({
  revisions,
  onRestore,
  disabled = false,
  loading = false,
  error,
  emptyMessage = "No revisions yet.",
  nextCursor,
  onLoadMore,
  loadMoreLabel = "Load more",
  now,
}: RevisionHistoryProps): ReactNode {
  const canLoadMore = Boolean(nextCursor) && onLoadMore !== undefined;
  const newest = revisions[0]?.rev;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold">Revision history</h3>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {revisions.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ol className="divide-y divide-border">
          {revisions.map((revision) => (
            <li key={revision.rev} className="flex items-center gap-3 py-2">
              <span className="text-sm font-medium">Revision {revision.rev}</span>
              <span className="text-sm text-muted-foreground">
                {new Date(revision.createdAt).toLocaleString()}
              </span>
              <StatusBadge doc={revision.doc} now={now} />
              <span className="ml-auto">
                {revision.rev === newest ? (
                  <Badge variant="secondary">Current</Badge>
                ) : onRestore !== undefined ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onRestore(revision.rev)}
                  >
                    Restore
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {canLoadMore ? (
        <Button variant="outline" onClick={onLoadMore} disabled={loading}>
          {loadMoreLabel}
        </Button>
      ) : null}
    </section>
  );
}
