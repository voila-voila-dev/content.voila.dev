// groupBy — bucket a list of documents by one field's value, for the kanban
// board's columns. Generic and display-only (the rows are already fetched). When
// the caller supplies the expected `columns` (e.g. an enum/select field's
// declared values), those columns appear in that order even when empty, and any
// row whose value isn't among them gets its own trailing column; rows with no
// value fall into a "None" column. Without declared columns, the columns are the
// distinct values in first-seen order.

import type { Doc } from "./doc";
import { humanize } from "./humanize";

export interface GroupColumn {
  /** The bucket's value, stringified (`""` for the no-value group). */
  readonly key: string;
  /** Display label for the column header. */
  readonly label: string;
  /**
   * The representative ORIGINAL (un-stringified) value for the bucket — what a
   * move should write back to the grouped field. A numeric enum keeps its
   * number here even though `key` is the string; the no-value bucket is `null`.
   */
  readonly raw: unknown;
  /** The rows in this bucket, in input order. */
  readonly rows: Doc[];
}

/** A declared column: the field value, with an optional display label. */
export interface DeclaredColumn {
  readonly value: string;
  readonly label?: string;
  /** The original value the stringified `value` came from (e.g. a numeric enum
   *  value); defaults to `value`. */
  readonly raw?: unknown;
}

export interface GroupByOptions {
  /** Expected columns in display order (e.g. an enum's values). */
  readonly columns?: ReadonlyArray<DeclaredColumn>;
  /** Label for the no-value bucket. Defaults to "None". */
  readonly noneLabel?: string;
}

/** The bucket key for a raw field value (empty string for null/undefined/""). */
function valueKey(raw: unknown): string {
  return raw === null || raw === undefined || raw === "" ? "" : String(raw);
}

export function groupBy(rows: readonly Doc[], field: string, opts?: GroupByOptions): GroupColumn[] {
  const noneLabel = opts?.noneLabel ?? "None";
  const order: string[] = [];
  const labels = new Map<string, string>();
  const raws = new Map<string, unknown>();
  const buckets = new Map<string, Doc[]>();

  // Seed declared columns first so empty ones still render, in declared order.
  for (const column of opts?.columns ?? []) {
    if (buckets.has(column.value)) continue;
    order.push(column.value);
    labels.set(column.value, column.label ?? humanize(column.value));
    raws.set(column.value, column.raw !== undefined ? column.raw : column.value);
    buckets.set(column.value, []);
  }

  for (const row of rows) {
    const rawValue = row[field];
    const key = valueKey(rawValue);
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(key, bucket);
      order.push(key);
      labels.set(key, key === "" ? noneLabel : key);
      // A discovered bucket keeps the row's actual value; the no-value bucket is null.
      raws.set(key, key === "" ? null : rawValue);
    }
    bucket.push(row);
  }

  return order.map((key) => ({
    key,
    label: labels.get(key) ?? (key === "" ? noneLabel : key),
    raw: raws.has(key) ? raws.get(key) : key === "" ? null : key,
    rows: buckets.get(key) ?? [],
  }));
}
