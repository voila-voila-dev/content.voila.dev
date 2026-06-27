// Default read-only display widgets — one small component per field kind. Each
// receives the field's value plus its `meta`, and returns a `ReactNode`. The
// widget registry (./registry) maps a field's `meta.widget ?? meta.kind` to one
// of these; `FieldRenderer` is the host. Edit widgets (for `CollectionForm`)
// land in a later slice — these are the cell/detail renderers.

import type { FieldMetaBase } from "@voila/content";
import { Badge } from "@voila/ui/badge";
import type { ReactNode } from "react";

export interface DisplayWidgetProps {
  readonly value: unknown;
  readonly meta: FieldMetaBase;
}

/** A read-only renderer for a single field value. */
export type DisplayWidget = (props: DisplayWidgetProps) => ReactNode;

/** Shared empty marker (muted em-dash) so blank values read the same
 *  everywhere — table cells, detail rows, dashboard counts. */
export function Empty(): ReactNode {
  return (
    <span data-slot="empty-display" className="text-muted-foreground">
      —
    </span>
  );
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

export function TextDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  return <span data-slot="text-display">{String(value)}</span>;
}

/**
 * An enum/select value as a small neutral chip, so a fixed-vocabulary field
 * (status, type, category) reads as a tag in a table cell / detail row — the
 * guide-scpi admin's status-column look, generalized (no domain-specific
 * coloring). The label is the field's option label when one matches the stored
 * value, else the raw value.
 */
export function EnumDisplay({ value, meta }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  return (
    <Badge data-slot="enum-display" variant="secondary">
      {enumLabel(meta, value)}
    </Badge>
  );
}

// The human label for an enum/select value: an `enum`'s `values` maps label →
// stored raw, so reverse-look it up (string-compared, since a numeric raw is
// stored as itself); a `select`'s `options` are already the labels.
function enumLabel(meta: FieldMetaBase, value: unknown): string {
  if (meta.kind === "enum") {
    const values = (meta as { values?: Record<string, string | number> }).values;
    const hit = values
      ? Object.entries(values).find(([, raw]) => String(raw) === String(value))
      : undefined;
    return hit?.[0] ?? String(value);
  }
  return String(value);
}

/**
 * Multi-line source text (markdown, code) — preserves line breaks and
 * indentation instead of letting HTML whitespace collapsing flatten the body
 * into one line in DataTable/DetailView.
 */
export function MultilineTextDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  return (
    <span data-slot="multiline-text-display" className="whitespace-pre-wrap break-words">
      {String(value)}
    </span>
  );
}

/**
 * A color value as a small swatch beside its string (hex or named), so a table
 * cell / detail row reads the actual color, not just the text. The swatch is
 * `aria-hidden` — the string carries the meaning for assistive tech.
 */
export function ColorDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  const color = String(value);
  return (
    <span data-slot="color-display" className="inline-flex items-center gap-2 align-middle">
      <span
        aria-hidden
        className="inline-block h-4 w-4 shrink-0 rounded border"
        style={{ backgroundColor: color }}
      />
      <span className="tabular-nums">{color}</span>
    </span>
  );
}

export function NumberDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (value === null || value === undefined) return <Empty />;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return <Empty />;
  return (
    <span data-slot="number-display" className="tabular-nums">
      {n.toLocaleString()}
    </span>
  );
}

export function BooleanDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (value === null || value === undefined) return <Empty />;
  // Muted variants on purpose — a solid-primary badge reads as a button, too
  // heavy for a plain value in a table cell.
  return (
    <Badge data-slot="boolean-display" variant={value ? "secondary" : "outline"}>
      {value ? "Yes" : "No"}
    </Badge>
  );
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
  return (
    <time data-slot="date-display" dateTime={d.toISOString()}>
      {text}
    </time>
  );
}

/** Concatenate a rich-text node's leaf text (children joined without spaces, so
 *  marks split across leaves don't gain gaps). */
function nodeText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) return n.children.map(nodeText).join("");
  return "";
}

/**
 * Flatten a `richText` value (the engine's node tree) to plain text — a small,
 * dependency-free walk (no platejs import) so list cells / detail rows can read
 * the document out of the box. The vended `rich-text-editor` item replaces this
 * with a faithful read-only render of the formatted content.
 */
export function RichTextValueDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (!Array.isArray(value)) return <Empty />;
  const text = value.map(nodeText).join(" ").replace(/\s+/g, " ").trim();
  if (text === "") return <Empty />;
  return (
    <span data-slot="rich-text-value-display" className="whitespace-pre-wrap break-words">
      {text}
    </span>
  );
}

/** Fallback for arrays/objects/unknown kinds — compact, never throws. */
export function JsonDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <Empty />;
    return (
      <span data-slot="json-display">
        {value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")}
      </span>
    );
  }
  if (typeof value === "object")
    return (
      <code data-slot="json-display" className="text-xs">
        {JSON.stringify(value)}
      </code>
    );
  return <span data-slot="json-display">{String(value)}</span>;
}
