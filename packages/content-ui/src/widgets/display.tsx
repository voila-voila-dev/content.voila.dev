// Default read-only display widgets — one small component per field kind. Each
// receives the field's value plus its `meta` and the render `context` (a table
// cell wants a one-line preview; the detail page has room), and returns a
// `ReactNode`. The widget registry (./registry) maps a field's
// `meta.widget ?? meta.kind` to one of these; `FieldRenderer` is the host.

import { CheckIcon, MinusIcon } from "@phosphor-icons/react";
import type { FieldMetaBase } from "@voila/content";
import { Badge } from "@voila.dev/ui/badge";
import { cn } from "@voila.dev/ui/utils";
import type { ReactNode } from "react";
import { markdownToPlain, richTextToPlain, truncateText } from "../lib/text";

/** Where a value is being rendered — widgets adapt size and density to it. */
export type DisplayContext = "cell" | "card" | "detail";

export interface DisplayWidgetProps {
  readonly value: unknown;
  readonly meta: FieldMetaBase;
  /** Defaults to `detail` when a host renders a widget directly. */
  readonly context?: DisplayContext;
}

/** A read-only renderer for a single field value. */
export type DisplayWidget = (props: DisplayWidgetProps) => ReactNode;

/** Whether the context is a dense one-line surface (a cell or a card line). */
export function isCompact(context?: DisplayContext): boolean {
  return context === "cell" || context === "card";
}

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

/** One line, clipped, with the full text on hover — the compact-surface preview. */
export function Preview({
  text,
  slot,
}: {
  readonly text: string;
  readonly slot: string;
}): ReactNode {
  return (
    <span
      data-slot={slot}
      title={text.length > 60 ? text : undefined}
      className="block max-w-[32ch] truncate"
    >
      {text}
    </span>
  );
}

export function TextDisplay({ value, context }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  const text = String(value);
  if (isCompact(context)) return <Preview text={text} slot="text-display" />;
  return <span data-slot="text-display">{text}</span>;
}

/**
 * Semantic colouring for the fixed vocabularies status-like fields tend to use.
 * Matched on the STORED value (and its label) by keyword, so `draft`/`review`/
 * `published` read at a glance; anything else stays the neutral chip.
 */
export type EnumTone = "neutral" | "draft" | "pending" | "positive" | "negative" | "archived";

const TONE_RULES: ReadonlyArray<readonly [RegExp, EnumTone]> = [
  [/^(draft|todo|new|backlog|open)$/i, "draft"],
  [/(review|pending|progress|scheduled|waiting|hold)/i, "pending"],
  [/^(published|active|done|complete[d]?|live|approved|paid|success)$/i, "positive"],
  [/(rejected|failed|error|cancel+ed|blocked|overdue|declined)/i, "negative"],
  [/(archived|inactive|closed|disabled|retired)/i, "archived"],
];

export function enumTone(raw: unknown, label: string): EnumTone {
  for (const candidate of [String(raw), label]) {
    for (const [pattern, tone] of TONE_RULES) if (pattern.test(candidate)) return tone;
  }
  return "neutral";
}

const TONE_CLASS: Record<EnumTone, string> = {
  neutral: "",
  draft: "border-transparent bg-muted text-muted-foreground",
  pending: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  positive: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  negative: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
  archived: "border-transparent bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

/**
 * An enum/select value as a small chip, so a fixed-vocabulary field (status,
 * type, category) reads as a tag in a table cell / detail row. Status-like
 * values pick up a semantic tone (see `enumTone`); the label is the field's
 * option label when one matches the stored value, else the raw value.
 */
export function EnumDisplay({ value, meta }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  const label = enumLabel(meta, value);
  const tone = enumTone(value, label);
  return (
    <Badge
      data-slot="enum-display"
      data-tone={tone}
      variant={tone === "neutral" ? "secondary" : "outline"}
      className={cn("whitespace-nowrap", TONE_CLASS[tone])}
    >
      {label}
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
 * Multi-line source text (markdown, code) — a one-line plain-text preview in a
 * cell; the full body with line breaks and indentation preserved on the detail
 * page (no prose margins, so it sits on the row's baseline).
 */
export function MultilineTextDisplay({ value, meta, context }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  const text = String(value);
  if (isCompact(context)) {
    const plain =
      meta.kind === "markdown" ? markdownToPlain(text) : text.replace(/\s+/g, " ").trim();
    return <Preview text={truncateText(plain, 160)} slot="multiline-text-display" />;
  }
  return (
    <span
      data-slot="multiline-text-display"
      className={cn("whitespace-pre-wrap break-words", meta.kind === "code" && "font-mono text-xs")}
    >
      {text}
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
      <span className="font-mono text-xs uppercase tabular-nums">{color}</span>
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

/** A boolean as a check / dash glyph (with a text label for assistive tech). */
export function BooleanDisplay({ value }: DisplayWidgetProps): ReactNode {
  if (value === null || value === undefined) return <Empty />;
  const on = value === true;
  return (
    <span
      data-slot="boolean-display"
      data-value={on ? "true" : "false"}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full",
        on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
      )}
    >
      {on ? (
        <CheckIcon className="size-3.5" weight="bold" aria-hidden />
      ) : (
        <MinusIcon className="size-3.5" aria-hidden />
      )}
      <span className="sr-only">{on ? "Yes" : "No"}</span>
    </span>
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

const DATE_FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  time: { timeStyle: "short" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
};

/** Format through `Intl` in the viewer's locale — no seconds, medium date. */
export function formatDate(d: Date, kind: string, locale?: string): string {
  const opts = DATE_FORMATS[kind] ?? DATE_FORMATS.datetime;
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/** "in 3 days" / "2 hours ago" for the hover title; `undefined` when unsupported. */
export function relativeDate(d: Date, now = Date.now(), locale?: string): string | undefined {
  if (typeof Intl.RelativeTimeFormat !== "function") return undefined;
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const units: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const [unit, ms] = units.find(([, size]) => abs >= size) ?? ["minute", 60_000];
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return rtf.format(Math.round(diff / ms), unit);
}

export function DateDisplay({ value, meta }: DisplayWidgetProps): ReactNode {
  const d = toDate(value);
  if (d === null) return <Empty />;
  // `time` fields store a bare HH:MM[:SS]; render the string minus seconds.
  if (meta.kind === "time" && typeof value === "string") {
    return (
      <time data-slot="date-display" dateTime={value} className="tabular-nums">
        {value.replace(/^(\d{2}:\d{2}):\d{2}.*$/, "$1")}
      </time>
    );
  }
  return (
    <time
      data-slot="date-display"
      dateTime={d.toISOString()}
      title={meta.kind === "date" ? undefined : relativeDate(d)}
      className="whitespace-nowrap tabular-nums"
    >
      {formatDate(d, meta.kind)}
    </time>
  );
}

/**
 * Flatten a `richText` value (the engine's node tree) to plain text — a small,
 * dependency-free walk (no platejs import) so list cells / detail rows can read
 * the document out of the box. The vended `rich-text-editor` item replaces this
 * with a faithful read-only render of the formatted content.
 */
export function RichTextValueDisplay({ value, context }: DisplayWidgetProps): ReactNode {
  if (!Array.isArray(value)) return <Empty />;
  const text = richTextToPlain(value);
  if (text === "") return <Empty />;
  if (isCompact(context)) {
    return <Preview text={truncateText(text, 160)} slot="rich-text-value-display" />;
  }
  return (
    <span data-slot="rich-text-value-display" className="whitespace-pre-wrap break-words">
      {text}
    </span>
  );
}

/** Fallback for arrays/objects/unknown kinds — compact, never throws. */
export function JsonDisplay({ value, context }: DisplayWidgetProps): ReactNode {
  if (isEmpty(value)) return <Empty />;
  if (Array.isArray(value)) {
    if (value.length === 0) return <Empty />;
    const text = value
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
      .join(", ");
    return isCompact(context) ? (
      <Preview text={text} slot="json-display" />
    ) : (
      <span data-slot="json-display">{text}</span>
    );
  }
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return (
      <code
        data-slot="json-display"
        className={cn("text-xs", isCompact(context) && "block max-w-[32ch] truncate")}
      >
        {text}
      </code>
    );
  }
  return <span data-slot="json-display">{String(value)}</span>;
}
