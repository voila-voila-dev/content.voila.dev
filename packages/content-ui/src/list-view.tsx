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
import type { Doc } from "./lib/doc";
import { humanize } from "./lib/humanize";
import type { DisplayRegistry } from "./registry/registry";
import { SearchInput } from "./search-input";
import { StatusFilter, type StatusFilterValue } from "./status-filter";

/** Whether a collection's `search` opt is on (boolean `true` or a non-empty list). */
function searchEnabled(search: Collection["search"]): boolean {
  if (search === undefined || search === false) return false;
  return Array.isArray(search) ? search.length > 0 : true;
}

export interface ListViewProps {
  readonly collection: Collection;
  /** The current page of rows (e.g. `client.<slug>.list(...).data`). */
  readonly rows: readonly Doc[];
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
  readonly onRowClick?: (row: Doc, index: number) => void;
  readonly loading?: boolean;
  /** Form-level error message (e.g. a failed fetch). */
  readonly error?: string;
  readonly emptyMessage?: string;
  /** Opaque cursor for the next page; when set with `onLoadMore`, shows the button. */
  readonly nextCursor?: string | null;
  readonly onLoadMore?: () => void;
  readonly loadMoreLabel?: string;
  /**
   * Selected publish-state scope, shown as a segmented filter. Only rendered
   * when the collection is draft-enabled and `onStatusChange` is wired; the
   * host refetches with `client.<slug>.list({ status })` on change.
   */
  readonly status?: StatusFilterValue;
  readonly onStatusChange?: (status: StatusFilterValue) => void;
  /**
   * Current search query, shown as a search box. Only rendered when the
   * collection is search-enabled and `onSearchChange` is wired; the host runs
   * `client.<slug>.search(query)` and feeds the ranked rows back in as `rows`.
   */
  readonly searchValue?: string;
  readonly onSearchChange?: (value: string) => void;
  readonly onSearchSubmit?: (value: string) => void;
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
  status = "any",
  onStatusChange,
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
}: ListViewProps): ReactNode {
  const heading = title ?? collection.label ?? humanize(collection.slug);
  const canLoadMore = Boolean(nextCursor) && onLoadMore !== undefined;
  const showSearch = searchEnabled(collection.search) && onSearchChange !== undefined;

  // What an assistive-tech user hears when the list's state changes. The
  // visible "Loading…" / "No records" text in `DataTable` isn't in a live
  // region, so screen readers stay silent on load, empty, and page changes
  // without this. Mirrors the load → empty/results progression below.
  const liveMessage = loading
    ? "Loading…"
    : rows.length === 0
      ? (emptyMessage ?? "No records.")
      : rows.length === 1
        ? "1 result"
        : `${rows.length} results`;

  return (
    <section className="space-y-4">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <header className="flex items-start gap-4">
        <div className="space-y-1">
          {/* `tabIndex={-1}` makes the page heading programmatically focusable so
              a host can move focus here on a route change (SPA focus management)
              without it landing in the tab order. */}
          <h1 tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            {heading}
          </h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>

      {collection.drafts === true && onStatusChange !== undefined ? (
        <StatusFilter value={status} onChange={onStatusChange} disabled={loading} />
      ) : null}

      {showSearch ? (
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
          disabled={loading}
        />
      ) : null}

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
        loading={loading}
        emptyMessage={emptyMessage}
      />

      {loading && rows.length > 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {canLoadMore ? (
        <Button variant="outline" onClick={onLoadMore} disabled={loading}>
          {loadMoreLabel}
        </Button>
      ) : null}
    </section>
  );
}
