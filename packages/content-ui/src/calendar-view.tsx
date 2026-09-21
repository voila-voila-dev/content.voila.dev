// CalendarView — lays a collection's rows out on a Month / Week / Day calendar
// (the shared `@voila.dev/ui` EventCalendar). It maps each row to a calendar event
// from a `startField` and an optional `endField`, then delegates rendering and
// navigation. Presentational and router-agnostic like the rest of content-ui:
// the host fetches the rows (see the bounded "load all" the list screen does for
// board views), persists the granularity via `view`/`onViewChange`, and wires
// `onRowClick`.
//
// Date mapping is timezone-correct for both field kinds: a `date` field stores a
// zone-less `YYYY-MM-DD` (read as an all-day event on that exact calendar day in
// every locale — never via `new Date("YYYY-MM-DD")`, which is UTC-midnight and
// slips a day in negative-offset zones); a `datetime` field stores an instant
// (read on its local day/time).

import type { Collection } from "@voila/content";
import {
  type CalendarEvent,
  type CalendarViewMode,
  EventCalendar,
} from "@voila.dev/ui/event-calendar";
import type { ReactNode } from "react";
import { documentTitle } from "./detail-view";
import type { Doc } from "./lib/doc";
import { getFieldLabel } from "./lib/humanize";
import { type I18nContextValue, resolveLocalized, useI18n } from "./lib/i18n";
import { richTextToPlain, truncateText } from "./lib/text";

export type { CalendarViewMode } from "@voila.dev/ui/event-calendar";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Instant {
  readonly date: Date;
  /** A bare `YYYY-MM-DD` (no time) — renders as an all-day event. */
  readonly dateOnly: boolean;
}

/** Parse a date/datetime field value into a local `Date` + whether it was date-only. */
export function readInstant(value: unknown): Instant | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const iso = ISO_DATE.exec(value);
    if (iso) {
      return { date: new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])), dateOnly: true };
    }
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? { date: new Date(ms), dateOnly: false } : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? { date: new Date(value), dateOnly: false } : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? { date: value, dateOnly: false } : null;
  }
  return null;
}

function rowId(row: Doc): string | undefined {
  const id = row.id;
  return typeof id === "string" ? id : typeof id === "number" ? String(id) : undefined;
}

/**
 * A stable colour per distinct value, so a calendar coloured by "screen" or
 * "kind" reads as a legend rather than a wall of identical grey blocks. The
 * palette is fixed and index-assigned by first appearance, which keeps a value's
 * colour stable across a render without needing the host to configure one.
 */
const EVENT_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
] as const;

/**
 * Resolve an event's colour. A `color` field is used verbatim (the editor picked
 * it); any other field is bucketed onto the palette by its value.
 */
export function eventColors(
  collection: Collection,
  rows: readonly Doc[],
  colorField: string | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  if (colorField === undefined) return out;
  const field = collection.fields[colorField];
  if (field === undefined) return out;
  const literal = field.meta.kind === "color";
  const assigned = new Map<string, string>();
  for (const row of rows) {
    const id = rowId(row);
    if (id === undefined) continue;
    const raw = row[colorField];
    if (raw === undefined || raw === null || raw === "") continue;
    if (literal) {
      if (typeof raw === "string") out.set(id, raw);
      continue;
    }
    const key = String(raw);
    let color = assigned.get(key);
    if (color === undefined) {
      color = EVENT_PALETTE[assigned.size % EVENT_PALETTE.length] as string;
      assigned.set(key, color);
    }
    out.set(id, color);
  }
  return out;
}

/** Map a collection's rows to calendar events, keyed back to their row by id. */
/** "Label: value" lines for the configured card fields, shown under the title. */
function cardMeta(
  collection: Collection,
  row: Doc,
  cardFields: readonly string[] | undefined,
  i18n?: I18nContextValue,
): string[] | undefined {
  if (!cardFields || cardFields.length === 0) return undefined;
  const lines = cardFields.flatMap((key) => {
    const field = collection.fields[key];
    if (!field) return [];
    const raw = row[key];
    const value = field.meta.localized === true ? resolveLocalized(raw, i18n).value : raw;
    const text =
      value === null || value === undefined || value === ""
        ? "—"
        : field.meta.kind === "richText"
          ? truncateText(richTextToPlain(value), 60)
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
    return [`${getFieldLabel(key, field)}: ${text}`];
  });
  return lines.length > 0 ? lines : undefined;
}

export function rowsToEvents(
  collection: Collection,
  rows: readonly Doc[],
  startField: string,
  endField: string | undefined,
  cardFields?: readonly string[],
  i18n?: I18nContextValue,
  colors?: Map<string, string>,
): { events: CalendarEvent[]; byId: Map<string, Doc> } {
  const byId = new Map<string, Doc>();
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    const id = rowId(row);
    if (id === undefined) continue;
    const start = readInstant(row[startField]);
    if (start === null) continue;
    const end = endField ? readInstant(row[endField]) : null;
    // A date-only end names an inclusive last day, so push it to the next
    // midnight — otherwise the calendar's half-open span would drop that day.
    let endDate = end?.date;
    if (end?.dateOnly && endDate) {
      endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
    }
    byId.set(id, row);
    events.push({
      id,
      title: documentTitle(collection, row, i18n) ?? "Untitled",
      start: start.date,
      end: endDate,
      allDay: start.dateOnly,
      color: colors?.get(id),
      meta: cardMeta(collection, row, cardFields, i18n),
    });
  }
  return { events, byId };
}

export interface CalendarViewProps {
  readonly collection: Collection;
  readonly rows: readonly Doc[];
  /** The date/datetime field an event starts on. */
  readonly startField: string;
  /** Optional date/datetime field an event ends on (range / multi-day events). */
  readonly endField?: string;
  /** Extra fields shown under each event's title. */
  readonly cardFields?: readonly string[];
  /**
   * Field whose value colours each event. A `color` field is used as-is; a
   * select/enum buckets onto a fixed palette, turning the month grid into a
   * legend for that dimension.
   */
  readonly colorField?: string;
  /** Active granularity; controlled when paired with `onViewChange`. */
  readonly view?: CalendarViewMode;
  readonly defaultView?: CalendarViewMode;
  readonly onViewChange?: (view: CalendarViewMode) => void;
  /** 0 = Sunday, 1 = Monday (default). */
  readonly weekStartsOn?: 0 | 1;
  readonly onRowClick?: (row: Doc) => void;
  readonly emptyMessage?: string;
}

function Root({
  collection,
  rows,
  startField,
  endField,
  cardFields,
  colorField,
  view,
  defaultView = "month",
  onViewChange,
  weekStartsOn = 1,
  onRowClick,
  emptyMessage = "No records.",
}: CalendarViewProps): ReactNode {
  const i18n = useI18n();
  const colors = eventColors(collection, rows, colorField);
  const { events, byId } = rowsToEvents(
    collection,
    rows,
    startField,
    endField,
    cardFields,
    i18n,
    colors,
  );

  if (events.length === 0) {
    return (
      <p data-slot="calendar-view" className="text-muted-foreground text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div data-slot="calendar-view">
      <EventCalendar.Root
        events={events}
        view={view}
        defaultView={defaultView}
        onViewChange={onViewChange}
        weekStartsOn={weekStartsOn}
        // Month / weekday / time labels follow the admin's formatting locale.
        locale={i18n.locale}
        onEventClick={
          onRowClick
            ? (event) => {
                const row = byId.get(event.id);
                if (row) onRowClick(row);
              }
            : undefined
        }
      />
    </div>
  );
}

/** Schema-driven calendar. `CalendarView.Root` maps rows to events on the shared
 *  `EventCalendar` (Month / Week / Day). */
export const CalendarView = {
  Root,
};
