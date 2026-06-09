// ListView — the list page for a collection: a header (title + description +
// an actions slot like a "New" button) over the schema-driven `DataTable`, plus
// loading / error states and keyset "Load more" pagination. It's presentational
// and router-agnostic — the host fetches a page with the typed
// `@voila/content/client` (`client.posts.list(...)` → `{ data, nextCursor }`),
// passes `rows`/`nextCursor` in, and wires `onLoadMore` / `onRowClick` /
// `actions` to navigation. Columns and cells still come entirely from the config.

import type { Collection } from "@voila/content";
import { Button } from "@voila/ui";
import type { ReactNode } from "react";
import { DataTable } from "./data-table";
import { humanize } from "./lib/humanize";
import type { DisplayRegistry } from "./registry/registry";

export interface ListViewProps {
  readonly collection: Collection;
  /** The current page of rows (e.g. `client.<slug>.list(...).data`). */
  readonly rows: readonly Record<string, unknown>[];
  /** Field keys to show, in order. Defaults to all non-hidden fields. */
  readonly columns?: readonly string[];
  /** Override display widgets per kind/name. */
  readonly registry?: DisplayRegistry;
  /** Header title. Defaults to the collection label, else the humanized slug. */
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  /** Header actions (e.g. a "New" link/button); rendered on the right. */
  readonly actions?: ReactNode;
  /** Make rows clickable (e.g. to open a detail page). */
  readonly onRowClick?: (row: Record<string, unknown>, index: number) => void;
  readonly loading?: boolean;
  /** Form-level error message (e.g. a failed fetch). */
  readonly error?: string;
  readonly emptyMessage?: string;
  /** Opaque cursor for the next page; when set with `onLoadMore`, shows the button. */
  readonly nextCursor?: string | null;
  readonly onLoadMore?: () => void;
  readonly loadMoreLabel?: string;
}

export function ListView({
  collection,
  rows,
  columns,
  registry,
  title,
  description,
  actions,
  onRowClick,
  loading = false,
  error,
  emptyMessage,
  nextCursor,
  onLoadMore,
  loadMoreLabel = "Load more",
}: ListViewProps): ReactNode {
  const heading = title ?? collection.label ?? humanize(collection.slug);
  const canLoadMore = Boolean(nextCursor) && onLoadMore !== undefined;

  return (
    <section className="space-y-4">
      <header className="flex items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{heading}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DataTable
        collection={collection}
        rows={rows}
        columns={columns}
        registry={registry}
        onRowClick={onRowClick}
        emptyMessage={emptyMessage}
      />

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {canLoadMore ? (
        <Button variant="outline" onClick={onLoadMore} disabled={loading}>
          {loadMoreLabel}
        </Button>
      ) : null}
    </section>
  );
}
