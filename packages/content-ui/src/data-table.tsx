// DataTable — renders a collection's documents as a table whose columns and
// cells come entirely from the field metadata. Pass a `collection` (from
// `defineConfig`) and its `rows`; columns default to every non-hidden field in
// declaration order, or pass an explicit `columns` list of field keys. Each
// cell renders through `FieldRenderer`, so the widget registry decides how a
// value is shown. Rows become clickable when `onRowClick` is set — the first
// cell then carries a visually-hidden "Open …" button (the row-link pattern),
// so assistive tech gets a named, keyboard-activatable control while pointer
// users keep the whole-row click target. `ListView` wraps this with a header,
// pagination, and loading/error chrome.

import type { Collection, Field } from "@voila/content";
import { Skeleton } from "@voila/ui/skeleton";
import { Table } from "@voila/ui/table";
import type { ReactNode } from "react";
import { documentTitle } from "./detail-view";
import { FieldRenderer } from "./field-renderer";
import type { Doc } from "./lib/doc";
import { getFieldLabel } from "./lib/humanize";
import type { DisplayRegistry } from "./registry/registry";

export interface DataTableProps {
  readonly collection: Collection;
  readonly rows: readonly Doc[];
  /** Field keys to show, in order. Defaults to all non-hidden fields. */
  readonly columns?: readonly string[];
  /** Override display widgets per kind/name. */
  readonly registry?: DisplayRegistry;
  /** Stable React key for a row; defaults to `row.id` then the index. */
  readonly rowKey?: (row: Doc, index: number) => string;
  /** When set, rows become clickable; each row also gets a visually-hidden
   *  "Open …" button (named from `titleField`) for keyboard/AT activation. */
  readonly onRowClick?: (row: Doc, index: number) => void;
  /** While true, an empty `rows` shows skeleton rows instead of `emptyMessage`. */
  readonly loading?: boolean;
  readonly emptyMessage?: string;
  readonly loadingMessage?: string;
  /** Number of placeholder rows to show while `loading` with no rows yet. */
  readonly skeletonRows?: number;
  readonly caption?: string;
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

export function DataTable({
  collection,
  rows,
  columns,
  registry,
  rowKey = defaultRowKey,
  onRowClick,
  loading = false,
  emptyMessage = "No records.",
  loadingMessage = "Loading…",
  skeletonRows = 5,
  caption,
}: DataTableProps): ReactNode {
  const cols = resolveColumns(collection, columns);
  const colCount = cols.length || 1;

  // Explicit ARIA roles on top of the native elements: Chrome's layout-table
  // heuristic can demote a styled table and drop row/columnheader semantics
  // from the a11y tree; redundant roles pin them.
  return (
    <Table.Root role="table">
      {caption ? <Table.Caption>{caption}</Table.Caption> : null}
      <Table.Header role="rowgroup">
        <Table.Row role="row">
          {cols.map((col) => (
            <Table.Head key={col.key} role="columnheader" scope="col" className="whitespace-nowrap">
              {col.label}
            </Table.Head>
          ))}
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
                    <Table.Cell key={`skeleton-${r}-${c}`} role="cell">
                      <Skeleton className="h-4 w-full" />
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
              <Table.Row role="row" className="sr-only">
                <Table.Cell role="cell" colSpan={colCount}>
                  {loadingMessage}
                </Table.Cell>
              </Table.Row>
            </>
          ) : (
            <Table.Row role="row">
              <Table.Cell
                role="cell"
                colSpan={colCount}
                className="text-center text-muted-foreground"
              >
                {emptyMessage}
              </Table.Cell>
            </Table.Row>
          )
        ) : (
          rows.map((row, index) => (
            <Table.Row
              key={rowKey(row, index)}
              role="row"
              className={onRowClick ? "cursor-pointer focus-within:bg-muted/50" : undefined}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
            >
              {cols.map((col, colIndex) => (
                <Table.Cell key={col.key} role="cell">
                  {/* The row-link pattern: a hidden but focusable button whose
                      native click bubbles to the row's onClick. Focus shows as
                      the row highlight (focus-within above). */}
                  {onRowClick && colIndex === 0 ? (
                    <button type="button" className="sr-only">
                      Open {documentTitle(collection, row) ?? `row ${index + 1}`}
                    </button>
                  ) : null}
                  <FieldRenderer field={col.field} value={row[col.key]} registry={registry} />
                </Table.Cell>
              ))}
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
}
