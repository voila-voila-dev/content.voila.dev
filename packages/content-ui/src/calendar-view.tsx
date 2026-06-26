// CalendarView — lays a collection's rows out on a Month / Week / Day calendar
// (the shared `@voila/ui` EventCalendar). It maps each row to a calendar event
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
import { type CalendarEvent, type CalendarViewMode, EventCalendar } from "@voila/ui/event-calendar";
import type { ReactNode } from "react";
import { documentTitle } from "./detail-view";
import type { Doc } from "./lib/doc";
import { getFieldLabel } from "./lib/humanize";

export type { CalendarViewMode } from "@voila/ui/event-calendar";

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

/** Map a collection's rows to calendar events, keyed back to their row by id. */
/** "Label: value" lines for the configured card fields, shown under the title. */
function cardMeta(
  collection: Collection,
  row: Doc,
  cardFields: readonly string[] | undefined,
): string[] | undefined {
  if (!cardFields || cardFields.length === 0) return undefined;
  const lines = cardFields.flatMap((key) => {
    const field = collection.fields[key];
    if (!field) return [];
    const value = row[key];
    const text =
      value === null || value === undefined || value === ""
        ? "—"
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
      title: documentTitle(collection, row) ?? "Untitled",
      start: start.date,
      end: endDate,
      allDay: start.dateOnly,
      meta: cardMeta(collection, row, cardFields),
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
  /** Active granularity; controlled when paired with `onViewChange`. */
  readonly view?: CalendarViewMode;
  readonly defaultView?: CalendarViewMode;
  readonly onViewChange?: (view: CalendarViewMode) => void;
  /** 0 = Sunday, 1 = Monday (default). */
  readonly weekStartsOn?: 0 | 1;
  readonly onRowClick?: (row: Doc) => void;
  readonly emptyMessage?: string;
}

export function CalendarView({
  collection,
  rows,
  startField,
  endField,
  cardFields,
  view,
  defaultView = "month",
  onViewChange,
  weekStartsOn = 1,
  onRowClick,
  emptyMessage = "No records.",
}: CalendarViewProps): ReactNode {
  const { events, byId } = rowsToEvents(collection, rows, startField, endField, cardFields);

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <EventCalendar
      events={events}
      view={view}
      defaultView={defaultView}
      onViewChange={onViewChange}
      weekStartsOn={weekStartsOn}
      onEventClick={
        onRowClick
          ? (event) => {
              const row = byId.get(event.id);
              if (row) onRowClick(row);
            }
          : undefined
      }
    />
  );
}
