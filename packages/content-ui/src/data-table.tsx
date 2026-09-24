// DataTable — renders a collection's documents as a table whose columns and
// cells come entirely from the field metadata. Pass a `collection` (from
// `defineConfig`) and its `rows`; columns default to every non-hidden field in
// declaration order, or pass an explicit `columns` list of field keys. Each
// cell renders through `FieldRenderer` in the `cell` context (one-line
// previews). Rows open a document two ways: `rowHref` puts a real link in the
// first cell (middle-click / new-tab work, and it's the keyboard target) and
// `onRowClick` makes the whole row a pointer target. `selectable` adds a
// checkbox column for bulk actions; `stickyHeader` pins the head row when the
// table's own container scrolls. `ListView` wraps this with a header, toolbar,
// pagination, and loading/error chrome.

import { CaretDownIcon, CaretUpDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import type { Collection, Field } from "@voila/content";
import { Checkbox } from "@voila.dev/ui/checkbox";
import { Skeleton } from "@voila.dev/ui/skeleton";
import { Table } from "@voila.dev/ui/table";
import { cn } from "@voila.dev/ui/utils";
import { cloneElement, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { documentTitle } from "./detail-view";
import { FieldRenderer } from "./field-renderer";
import type { Doc } from "./lib/doc";
import { getFieldLabel } from "./lib/humanize";
import { useI18n } from "./lib/i18n";
import { useMessages } from "./lib/messages";
import type { DisplayRegistry } from "./registry/registry";

export type TableDensity = "compact" | "comfortable";

export interface DataTableProps {
  readonly collection: Collection;
  readonly rows: readonly Doc[];
  /** Field keys to show, in order. Defaults to all non-hidden fields. */
  readonly columns?: readonly string[];
  /** Override display widgets per kind/name. */
  readonly registry?: DisplayRegistry;
  /** Stable React key for a row; defaults to `row.id` then the index. */
  readonly rowKey?: (row: Doc, index: number) => string;
  /** When set, the whole row is a pointer target. */
  readonly onRowClick?: (row: Doc, index: number) => void;
  /** When set, the first cell carries a real link to the row (new-tab friendly). */
  readonly rowHref?: (row: Doc, index: number) => string;
  /** Render the row link (a framework `Link`); defaults to a plain `<a>`. */
  readonly renderLink?: (href: string) => ReactElement;
  /** The active sort (column key + direction), shown as a header indicator. */
  readonly sort?: { readonly field: string; readonly direction: "asc" | "desc" };
  /** When set, sortable column headers become buttons; clicking one calls this
   *  with the column key (the host toggles direction + refetches). */
  readonly onSortChange?: (field: string) => void;
  /** Adds a leading checkbox column; `selected` holds the checked row keys. */
  readonly selectable?: boolean;
  readonly selected?: ReadonlySet<string>;
  readonly onSelectedChange?: (keys: ReadonlySet<string>) => void;
  /** Row height. `compact` (default) lands rows at ~36px. */
  readonly density?: TableDensity;
  /** Pin the head row inside a scrolling container. */
  readonly stickyHeader?: boolean;
  /** While true, an empty `rows` shows skeleton rows instead of `emptyMessage`. */
  readonly loading?: boolean;
  readonly emptyMessage?: string;
  /** A rich empty state replacing the single-cell `emptyMessage`. */
  readonly empty?: ReactNode;
  readonly loadingMessage?: string;
  /** Number of placeholder rows to show while `loading` with no rows yet. */
  readonly skeletonRows?: number;
  readonly caption?: string;
  /**
   * Per-row actions, revealed on hover / keyboard focus in a trailing column.
   * Opening a record to duplicate or delete it is a round trip an editor makes
   * constantly; this puts those one click from the row. The column only exists
   * when this is set, so tables that don't want it are unchanged.
   */
  readonly rowActions?: (row: Doc, index: number) => ReactNode;
}

interface Column {
  readonly key: string;
  readonly label: string;
  readonly field: Field;
}

/** Resolve the columns to render: explicit `columns` (filtered to known fields)
 *  or every non-hidden field in declaration order. */
function resolveColumns(collection: Collection, columns?: readonly string[]): Column[] {
  const keys = columns ?? Object.keys(collection.fields);
  const out: Column[] = [];
  for (const key of keys) {
    const field = collection.fields[key];
    if (!field) continue;
    if (columns === undefined && field.meta.hidden) continue;
    out.push({ key, label: getFieldLabel(key, field), field });
  }
  return out;
}

function defaultRowKey(row: Doc, index: number): string {
  const id = row.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : String(index);
}

// Field kinds that map to a single scalar column and so can be sorted server-side
// (mirrors the engine's read-path gate). JSON-backed and localized fields aren't.
const SORTABLE_KINDS: ReadonlySet<string> = new Set([
  "string",
  "slug",
  "id",
  "enum",
  "select",
  "color",
  "code",
  "markdown",
  "secret",
  "password",
  "number",
  "boolean",
  "date",
  "datetime",
  "time",
  "duration",
  "position",
]);

function isSortable(field: Field): boolean {
  return field.meta.localized !== true && SORTABLE_KINDS.has(field.meta.kind);
}

const CELL_DENSITY: Record<TableDensity, string> = {
  compact: "px-3 py-1.5 text-[0.8125rem]",
  comfortable: "px-3 py-2.5 text-sm",
};

const HEAD_DENSITY: Record<TableDensity, string> = {
  compact: "h-9 px-3 text-xs",
  comfortable: "h-10 px-3 text-xs",
};

function defaultRenderLink(href: string): ReactElement {
  // biome-ignore lint/a11y/useAnchorContent: children are injected by the caller
  return <a href={href} />;
}

/** Whether a click landed on an interactive element inside the row (a link, a
 *  checkbox, a button) that should win over the row-level click. */
function isInteractiveTarget(event: MouseEvent, row: HTMLElement): boolean {
  let node = event.target as HTMLElement | null;
  while (node && node !== row) {
    const tag = node.tagName;
    if (
      tag === "A" ||
      tag === "BUTTON" ||
      tag === "INPUT" ||
      node.getAttribute("role") === "checkbox"
    )
      return true;
    node = node.parentElement;
  }
  return false;
}

function Root({
  collection,
  rows,
  columns,
  registry,
  rowKey = defaultRowKey,
  onRowClick,
  rowHref,
  renderLink = defaultRenderLink,
  sort,
  onSortChange,
  selectable = false,
  selected,
  onSelectedChange,
  density = "compact",
  stickyHeader = false,
  loading = false,
  emptyMessage,
  empty,
  loadingMessage,
  skeletonRows = 5,
  rowActions,
  caption,
}: DataTableProps): ReactNode {
  const i18n = useI18n();
  const m = useMessages();
  const cols = resolveColumns(collection, columns);
  const colCount = (cols.length || 1) + (selectable ? 1 : 0) + (rowActions ? 1 : 0);
  const clickable = onRowClick !== undefined || rowHref !== undefined;
  const cell = CELL_DENSITY[density];
  const head = HEAD_DENSITY[density];

  const keys = rows.map((row, index) => rowKey(row, index));
  const allSelected = selectable && keys.length > 0 && keys.every((k) => selected?.has(k));
  const someSelected = selectable && !allSelected && keys.some((k) => selected?.has(k));

  function toggleAll(checked: boolean) {
    onSelectedChange?.(new Set(checked ? keys : []));
  }
  function toggleOne(key: string, checked: boolean) {
    const next = new Set(selected ?? []);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectedChange?.(next);
  }

  // Explicit ARIA roles on top of the native elements: Chrome's layout-table
  // heuristic can demote a styled table and drop row/columnheader semantics
  // from the a11y tree; redundant roles pin them.
  return (
    <Table.Root data-slot="data-table" data-density={density} role="table" className="text-sm">
      {caption ? <Table.Caption>{caption}</Table.Caption> : null}
      <Table.Header
        role="rowgroup"
        className={cn(
          stickyHeader && "sticky top-0 z-10 bg-background shadow-[inset_0_-1px_0_var(--border)]",
        )}
      >
        <Table.Row role="row" className="hover:bg-transparent">
          {selectable ? (
            <Table.Head role="columnheader" scope="col" className={cn(head, "w-9 pr-0")}>
              <Checkbox
                size="sm"
                aria-label={m.list.selectAll}
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </Table.Head>
          ) : null}
          {cols.map((col) => {
            const sortable = onSortChange !== undefined && isSortable(col.field);
            const active = sort?.field === col.key;
            const ariaSort = active
              ? sort?.direction === "asc"
                ? "ascending"
                : "descending"
              : undefined;
            const SortIcon = active
              ? sort?.direction === "asc"
                ? CaretUpIcon
                : CaretDownIcon
              : CaretUpDownIcon;
            return (
              <Table.Head
                key={col.key}
                role="columnheader"
                scope="col"
                className={cn(head, "whitespace-nowrap font-medium text-muted-foreground")}
                aria-sort={ariaSort}
              >
                {sortable ? (
                  <button
                    type="button"
                    className={cn(
                      "-mx-2 inline-flex h-7 cursor-pointer select-none items-center gap-1 rounded-md px-2 hover:bg-muted/60 hover:text-foreground",
                      active && "text-foreground",
                    )}
                    onClick={() => onSortChange(col.key)}
                  >
                    {col.label}
                    <SortIcon
                      aria-hidden
                      className={cn(
                        "size-3.5",
                        active ? "text-foreground" : "text-muted-foreground/70",
                      )}
                    />
                  </button>
                ) : (
                  col.label
                )}
              </Table.Head>
            );
          })}
          {rowActions ? (
            <Table.Head className={cn(head, "w-0")}>
              <span className="sr-only">{m.list.actions}</span>
            </Table.Head>
          ) : null}
        </Table.Row>
      </Table.Header>
      <Table.Body role="rowgroup">
        {rows.length === 0 ? (
          loading ? (
            <>
              {/* Decorative shimmer rows for perceived performance — hidden from
                  AT, which instead hears the visually-hidden status row below
                  (and `ListView`'s `aria-live` region). */}
              {Array.from({ length: skeletonRows }).map((_, r) => (
                <Table.Row key={`skeleton-${r}`} role="row" aria-hidden="true">
                  {Array.from({ length: colCount }).map((_, c) => (
                    <Table.Cell key={`skeleton-${r}-${c}`} role="cell" className={cell}>
                      <Skeleton className="h-4 w-full bg-muted-foreground/15" />
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
              <Table.Row role="row" className="sr-only">
                <Table.Cell role="cell" colSpan={colCount}>
                  {loadingMessage ?? m.common.loading}
                </Table.Cell>
              </Table.Row>
            </>
          ) : (
            <Table.Row role="row" className="hover:bg-transparent">
              <Table.Cell
                role="cell"
                colSpan={colCount}
                className={cn(empty ? "p-0" : "py-10 text-center text-muted-foreground")}
              >
                {empty ?? emptyMessage ?? m.list.noRecords}
              </Table.Cell>
            </Table.Row>
          )
        ) : (
          rows.map((row, index) => {
            const key = keys[index] as string;
            const href = rowHref?.(row, index);
            const isSelected = selected?.has(key) === true;
            const name = documentTitle(collection, row, i18n) ?? m.list.rowN(index + 1);
            return (
              <Table.Row
                key={key}
                role="row"
                data-state={isSelected ? "selected" : undefined}
                aria-selected={selectable ? isSelected : undefined}
                className={cn(
                  "group/row",
                  clickable && "cursor-pointer focus-within:bg-muted/50",
                  isSelected && "bg-muted/50",
                )}
                onClick={
                  onRowClick
                    ? (event) => {
                        if (isInteractiveTarget(event, event.currentTarget)) return;
                        onRowClick(row, index);
                      }
                    : undefined
                }
              >
                {selectable ? (
                  <Table.Cell role="cell" className={cn(cell, "w-9 pr-0")}>
                    <Checkbox
                      size="sm"
                      aria-label={m.list.selectRow(name)}
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleOne(key, checked === true)}
                    />
                  </Table.Cell>
                ) : null}
                {cols.map((col, colIndex) => {
                  const content = (
                    <FieldRenderer
                      field={col.field}
                      value={row[col.key]}
                      registry={registry}
                      context="cell"
                    />
                  );
                  const first = colIndex === 0;
                  return (
                    <Table.Cell
                      key={col.key}
                      role="cell"
                      className={cn(
                        cell,
                        "max-w-[40ch] align-middle",
                        first && clickable && "font-medium",
                      )}
                    >
                      {first && href ? (
                        // The row-link: a real anchor on the first cell (new-tab,
                        // middle-click, keyboard) whose click the row handler
                        // defers to. Named from the title field for AT.
                        cloneElement(
                          renderLink(href) as ReactElement<Record<string, unknown>>,
                          {
                            "data-slot": "row-link",
                            "aria-label": m.list.openRow(name),
                            className:
                              "block rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
                          },
                          content,
                        )
                      ) : first && onRowClick ? (
                        <>
                          {/* No href: keep the visually-hidden focusable button
                              so keyboard/AT users still have a named control. It
                              opens the row itself (the row handler defers to it). */}
                          <button
                            type="button"
                            className="sr-only"
                            onClick={() => onRowClick(row, index)}
                          >
                            {m.list.openRow(name)}
                          </button>
                          {content}
                        </>
                      ) : (
                        content
                      )}
                    </Table.Cell>
                  );
                })}
                {rowActions ? (
                  // Revealed on hover, and on keyboard focus anywhere in the row
                  // (`focus-within`) so the actions are reachable without a mouse
                  // rather than being a pointer-only affordance.
                  <Table.Cell
                    role="cell"
                    className={cn(cell, "w-0 whitespace-nowrap pl-2 text-right")}
                  >
                    <span
                      data-slot="row-actions"
                      className={cn(
                        "inline-flex items-center gap-0.5 opacity-0 transition-opacity",
                        "group-hover/row:opacity-100 focus-within:opacity-100",
                      )}
                    >
                      {rowActions(row, index)}
                    </span>
                  </Table.Cell>
                ) : null}
              </Table.Row>
            );
          })
        )}
      </Table.Body>
    </Table.Root>
  );
}

/** Schema-driven table. `DataTable.Root` is the table; columns and cells come
 *  from the collection's field metadata. */
export const DataTable = {
  Root,
};
