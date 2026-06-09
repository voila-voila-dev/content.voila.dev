// DataTable — renders a collection's documents as a table whose columns and
// cells come entirely from the field metadata. Pass a `collection` (from
// `defineConfig`) and its `rows`; columns default to every non-hidden field in
// declaration order, or pass an explicit `columns` list of field keys. Each
// cell renders through `FieldRenderer`, so the widget registry decides how a
// value is shown. Rows become clickable when `onRowClick` is set; `ListView`
// wraps this with a header, pagination, and loading/error chrome.

import type { Collection, Field } from "@voila/content";
import { Table } from "@voila/ui";
import type { KeyboardEvent, ReactNode } from "react";
import { FieldRenderer } from "./field-renderer";
import { humanize } from "./lib/humanize";
import type { DisplayRegistry } from "./registry/registry";

export interface DataTableProps {
  readonly collection: Collection;
  readonly rows: readonly Record<string, unknown>[];
  /** Field keys to show, in order. Defaults to all non-hidden fields. */
  readonly columns?: readonly string[];
  /** Override display widgets per kind/name. */
  readonly registry?: DisplayRegistry;
  /** Stable React key for a row; defaults to `row.id` then the index. */
  readonly rowKey?: (row: Record<string, unknown>, index: number) => string;
  /** When set, rows become clickable (and keyboard-activatable via Enter/Space). */
  readonly onRowClick?: (row: Record<string, unknown>, index: number) => void;
  readonly emptyMessage?: string;
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
    out.push({ key, label: field.meta.label ?? humanize(key), field });
  }
  return out;
}

function defaultRowKey(row: Record<string, unknown>, index: number): string {
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
  emptyMessage = "No records.",
  caption,
}: DataTableProps): ReactNode {
  const cols = resolveColumns(collection, columns);

  // Enter/Space activate a focused clickable row, matching native button keys.
  function handleRowKey(
    event: KeyboardEvent<HTMLTableRowElement>,
    row: Record<string, unknown>,
    index: number,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row, index);
    }
  }

  return (
    <Table.Root>
      {caption ? <Table.Caption>{caption}</Table.Caption> : null}
      <Table.Header>
        <Table.Row>
          {cols.map((col) => (
            <Table.Head key={col.key}>{col.label}</Table.Head>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={cols.length || 1} className="text-center text-muted-foreground">
              {emptyMessage}
            </Table.Cell>
          </Table.Row>
        ) : (
          rows.map((row, index) => (
            <Table.Row
              key={rowKey(row, index)}
              className={onRowClick ? "cursor-pointer" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              onKeyDown={onRowClick ? (e) => handleRowKey(e, row, index) : undefined}
            >
              {cols.map((col) => (
                <Table.Cell key={col.key}>
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
