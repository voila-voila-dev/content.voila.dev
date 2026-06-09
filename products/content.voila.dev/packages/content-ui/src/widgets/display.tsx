// Default read-only display widgets — one small component per field kind. Each
// receives the field's value plus its `meta`, and returns a `ReactNode`. The
// widget registry (./registry) maps a field's `meta.widget ?? meta.kind` to one
// of these; `FieldRenderer` is the host. Edit widgets (for `CollectionForm`)
// land in a later slice — these are the cell/detail renderers.

import type { FieldMetaBase } from "@voila/content";
import { Badge } from "@voila/ui";
import type { ReactNode } from "react";

export interface DisplayWidgetProps {
  readonly value: unknown;
  readonly meta: FieldMetaBase;
}

/** A read-only renderer for a single field value. */
export type DisplayWidget = (props: DisplayWidgetProps) => ReactNode;

/** Shared empty marker so blank cells read the same everywhere. */
function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function TextDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  return <span>{String(value)}</span>;
}

export function NumberDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (value === null || value === undefined) return <Empty />;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return <Empty />;
  return <span className="tabular-nums">{n.toLocaleString()}</span>;
}

export function BooleanDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (value === null || value === undefined) return <Empty />;
  return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>;
}

/** Coerce the values a date field round-trips to (Date, epoch ms, ISO string). */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function DateDisplay({ value, meta }: DisplayWidgetProps): ReactNode {
  const d = toDate(value);
  if (d === null) return <Empty />;
  const text =
    meta.kind === "date"
      ? d.toLocaleDateString()
      : meta.kind === "time"
        ? d.toLocaleTimeString()
        : d.toLocaleString();
  return <time dateTime={d.toISOString()}>{text}</time>;
}

/** Fallback for arrays/objects/unknown kinds — compact, never throws. */
export function JsonDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <Empty />;
    return (
      <span>
        {value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")}
      </span>
    );
  }
  if (typeof value === "object") return <code className="text-xs">{JSON.stringify(value)}</code>;
  return <span>{String(value)}</span>;
}
