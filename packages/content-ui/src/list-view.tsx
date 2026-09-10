// ListView — the list page for a collection: the single page header (title +
// actions like "New") over a pinned strip (view tabs + toolbar: search, status
// scope, filters/columns/density controls the host passes in) and the
// schema-driven `DataTable` in its own scrolling region (so the head row stays
// pinned), plus loading / error / empty states, row selection with a bulk
// action bar, and keyset "Load more" pagination with a result count line. It's
// presentational and router-agnostic — the host fetches a page with the typed
// `@voila/content/client` (`client.posts.list(...)` → `{ data, nextCursor }`),
// passes `rows`/`nextCursor` in, and wires `onLoadMore` / `rowHref` /
// `onRowClick` / `actions` to navigation. Columns and cells still come entirely
// from the config.

import { RowsIcon, RowsPlusBottomIcon } from "@phosphor-icons/react";
import type { Collection } from "@voila/content";
import { Button } from "@voila.dev/ui/button";
import { Empty } from "@voila.dev/ui/empty";
import { NativeSelect } from "@voila.dev/ui/native-select";
import { cn } from "@voila.dev/ui/utils";
import { type ReactElement, type ReactNode, useState } from "react";
import { DataTable, type TableDensity } from "./data-table";
import type { Doc } from "./lib/doc";
import { humanize } from "./lib/humanize";
import { NamedIcon } from "./lib/icons";
import { PageLayout, pageGutter } from "./page-layout";
import type { DisplayRegistry } from "./registry/registry";
import { SearchInput } from "./search-input";
import { StatusFilter, type StatusFilterValue } from "./status-filter";

/** Whether a collection's `search` opt is on (boolean `true` or a non-empty list). */
export function searchEnabled(search: Collection["search"]): boolean {
  if (search === undefined || search === false) return false;
  return Array.isArray(search) ? search.length > 0 : true;
}

export const PAGE_SIZES = [25, 50, 100] as const;

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
  /** The header's back link (see `PageLayout.Back`). */
  readonly back?: ReactNode;
  /** Header actions (e.g. a "New" link/button); rendered on the right. */
  readonly actions?: ReactNode;
  /** A pinned slot above the toolbar (e.g. view tabs). */
  readonly header?: ReactNode;
  /** Extra toolbar controls (filters, columns, view options) on the right. */
  readonly toolbar?: ReactNode;
  /** Make rows clickable (e.g. to open a detail page). */
  readonly onRowClick?: (row: Doc, index: number) => void;
  /** A real link per row (first cell), for new-tab / middle-click. */
  readonly rowHref?: (row: Doc, index: number) => string;
  readonly renderLink?: (href: string) => ReactElement;
  /** The active sort; when set with `onSortChange`, headers become sortable. */
  readonly sort?: { readonly field: string; readonly direction: "asc" | "desc" };
  readonly onSortChange?: (field: string) => void;
  readonly loading?: boolean;
  /** Form-level error message (e.g. a failed fetch). */
  readonly error?: string;
  readonly emptyMessage?: string;
  /** A primary action for the empty state (e.g. a "New post" button). */
  readonly emptyAction?: ReactNode;
  /** Opaque cursor for the next page; when set with `onLoadMore`, shows the button. */
  readonly nextCursor?: string | null;
  readonly onLoadMore?: () => void;
  readonly loadMoreLabel?: string;
  /** Total rows in scope (all pages), for the "Showing N of M" line. */
  readonly total?: number;
  /** Page size; with `onPageSizeChange`, shows a size picker in the count line. */
  readonly pageSize?: number;
  readonly onPageSizeChange?: (size: number) => void;
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
  /** Row selection for bulk actions. Keys are row ids (see `DataTable.rowKey`). */
  readonly selectable?: boolean;
  readonly selected?: ReadonlySet<string>;
  readonly onSelectedChange?: (keys: ReadonlySet<string>) => void;
  /** Bulk actions shown in the selection bar (receives the selected keys). */
  readonly bulkActions?: (selected: ReadonlySet<string>) => ReactNode;
  /** Per-row actions revealed on hover / focus (see `DataTable.rowActions`). */
  readonly rowActions?: (row: Doc, index: number) => ReactNode;
  /** Row density; uncontrolled (with a toolbar toggle) when omitted. */
  readonly density?: TableDensity;
  readonly onDensityChange?: (density: TableDensity) => void;
}

function Root({
  collection,
  rows,
  columns,
  registry,
  title,
  description,
  back,
  actions,
  header,
  toolbar,
  onRowClick,
  rowHref,
  renderLink,
  sort,
  onSortChange,
  loading = false,
  error,
  emptyMessage,
  emptyAction,
  nextCursor,
  onLoadMore,
  loadMoreLabel = "Load more",
  total,
  pageSize,
  onPageSizeChange,
  status = "any",
  onStatusChange,
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  selectable = false,
  selected,
  onSelectedChange,
  bulkActions,
  rowActions,
  density,
  onDensityChange,
}: ListViewProps): ReactNode {
  const heading = title ?? collection.label ?? humanize(collection.slug);
  const canLoadMore = Boolean(nextCursor) && onLoadMore !== undefined;
  // The search box is always offered when the host wires it. A collection
  // without full-text search still gets a box — the host narrows the loaded
  // rows by title instead — because "I can see the field but can't type a
  // title" is the confusing state, not the missing index.
  const fullText = searchEnabled(collection.search);
  const showSearch = onSearchChange !== undefined;
  const searchPlaceholder = fullText
    ? `Search ${String(heading).toLowerCase()}…`
    : "Filter by title…";
  const showStatusFilter = collection.drafts === true && onStatusChange !== undefined;
  const [internalDensity, setInternalDensity] = useState<TableDensity>("compact");
  const activeDensity = density ?? internalDensity;
  function toggleDensity() {
    const next: TableDensity = activeDensity === "compact" ? "comfortable" : "compact";
    setInternalDensity(next);
    onDensityChange?.(next);
  }
  const [internalSelected, setInternalSelected] = useState<ReadonlySet<string>>(() => new Set());
  const selectedSet = selected ?? internalSelected;
  const selectedCount = selectedSet.size;
  function changeSelected(next: ReadonlySet<string>) {
    setInternalSelected(next);
    onSelectedChange?.(next);
  }

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

  const countLine =
    rows.length === 0
      ? null
      : typeof total === "number" && total >= rows.length
        ? `Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} ${total === 1 ? "record" : "records"}`
        : `Showing ${rows.length.toLocaleString()} ${rows.length === 1 ? "record" : "records"}${canLoadMore ? " — more available" : ""}`;

  const emptyState = (
    <Empty.Root className="py-12">
      <Empty.Header>
        <Empty.Media variant="icon">
          <NamedIcon name={collection.icon} fallback="StackSimple" />
        </Empty.Media>
        <Empty.Title>{emptyMessage ?? `No ${String(heading).toLowerCase()} yet`}</Empty.Title>
        <Empty.Description>
          {searchValue
            ? fullText
              ? "Nothing matches this search. Try another term or clear the filters."
              : "No loaded record has a matching title. Clear the filter, or load more records."
            : "Records you create will show up here."}
        </Empty.Description>
      </Empty.Header>
      {emptyAction ? <Empty.Content>{emptyAction}</Empty.Content> : null}
    </Empty.Root>
  );

  return (
    <PageLayout.Root data-slot="list-view">
      <PageLayout.Header back={back} actions={actions}>
        <PageLayout.Title>{heading}</PageLayout.Title>
        {description ? <PageLayout.Description>{description}</PageLayout.Description> : null}
      </PageLayout.Header>

      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {/* Pinned strip: the view tabs (aligned to the title gutter) over one
          toolbar row — search grows on the left, filters/columns/density sit on
          the right. It never scrolls with the table. */}
      <PageLayout.Toolbar>
        {header ? <div className={cn(pageGutter)}>{header}</div> : null}
        {
          <div
            data-slot="list-toolbar"
            className={cn("flex flex-wrap items-center gap-2 py-2", pageGutter)}
          >
            {showSearch ? (
              <div className="min-w-48 flex-1 sm:max-w-xs">
                <SearchInput
                  value={searchValue}
                  onChange={onSearchChange}
                  onSubmit={onSearchSubmit}
                  placeholder={searchPlaceholder}
                  disabled={loading}
                />
              </div>
            ) : null}
            {showStatusFilter ? (
              <StatusFilter value={status} onChange={onStatusChange} disabled={loading} />
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {toolbar}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={activeDensity === "compact" ? "Comfortable rows" : "Compact rows"}
                aria-pressed={activeDensity === "comfortable"}
                title={activeDensity === "compact" ? "Comfortable rows" : "Compact rows"}
                onClick={toggleDensity}
              >
                {activeDensity === "compact" ? <RowsPlusBottomIcon /> : <RowsIcon />}
              </Button>
            </div>
          </div>
        }
        {selectable && selectedCount > 0 ? (
          <div
            data-slot="list-selection-bar"
            className={cn(
              "flex flex-wrap items-center gap-2 border-t bg-muted/40 py-1.5 text-sm",
              pageGutter,
            )}
          >
            <span className="font-medium tabular-nums">{selectedCount} selected</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => changeSelected(new Set())}
            >
              Clear
            </Button>
            <div className="ml-auto flex items-center gap-2">{bulkActions?.(selectedSet)}</div>
          </div>
        ) : null}
      </PageLayout.Toolbar>

      {error ? (
        <div className={cn("pt-3", pageGutter)}>
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        </div>
      ) : null}

      {/* The table owns the vertical scroll so its head row can stay pinned. */}
      <div data-slot="list-table" className="min-h-0 flex-1 overflow-auto">
        <DataTable.Root
          collection={collection}
          rows={rows}
          columns={columns}
          registry={registry}
          onRowClick={onRowClick}
          rowHref={rowHref}
          renderLink={renderLink}
          sort={sort}
          onSortChange={onSortChange}
          loading={loading}
          emptyMessage={emptyMessage}
          empty={emptyState}
          density={activeDensity}
          stickyHeader
          selectable={selectable}
          selected={selectable ? selectedSet : undefined}
          onSelectedChange={selectable ? changeSelected : undefined}
          rowActions={rowActions}
        />
      </div>

      <PageLayout.Footer className="min-h-12 py-2 text-muted-foreground text-xs">
        <div className="flex items-center gap-3">
          {loading && rows.length > 0 ? <span>Loading…</span> : <span>{countLine}</span>}
          {pageSize !== undefined && onPageSizeChange ? (
            <div className="flex items-center gap-1.5">
              <span aria-hidden>Per page</span>
              <NativeSelect.Root
                size="sm"
                aria-label="Rows per page"
                value={String(pageSize)}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                wrapperClassName="w-20"
              >
                {PAGE_SIZES.map((size) => (
                  <NativeSelect.Option key={size} value={String(size)}>
                    {size}
                  </NativeSelect.Option>
                ))}
              </NativeSelect.Root>
            </div>
          ) : null}
        </div>
        {canLoadMore ? (
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loadMoreLabel}
          </Button>
        ) : null}
      </PageLayout.Footer>
    </PageLayout.Root>
  );
}

/** Schema-driven list page for a collection. `ListView.Root` renders the header,
 *  pinned tabs + toolbar (search / status / host controls), the `DataTable`, a
 *  selection bar, and keyset pagination. */
export const ListView = {
  Root,
};
