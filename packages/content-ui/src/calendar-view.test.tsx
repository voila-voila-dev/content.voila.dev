import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { CalendarView, readInstant, rowsToEvents } from "./calendar-view";

afterEach(cleanup);

const events = defineCollection({
  slug: "events",
  titleField: "title",
  fields: {
    title: fields.string(),
    startsAt: fields.datetime(),
    endsAt: fields.datetime(),
    on: fields.date(),
    to: fields.date(),
  },
});

describe("readInstant", () => {
  test("reads a bare YYYY-MM-DD as a zone-less, date-only local day", () => {
    const got = readInstant("2026-06-25");
    expect(got?.dateOnly).toBe(true);
    expect(got?.date.getFullYear()).toBe(2026);
    expect(got?.date.getMonth()).toBe(5);
    expect(got?.date.getDate()).toBe(25);
  });

  test("reads instants (Date / epoch ms / ISO) as timed", () => {
    const d = new Date(2026, 5, 25, 9, 30);
    expect(readInstant(d)).toMatchObject({ dateOnly: false });
    expect(readInstant(d.getTime())).toMatchObject({ dateOnly: false });
    expect(readInstant(d.toISOString())).toMatchObject({ dateOnly: false });
  });

  test("returns null for missing / unparseable values", () => {
    expect(readInstant(null)).toBeNull();
    expect(readInstant(undefined)).toBeNull();
    expect(readInstant("nope")).toBeNull();
    expect(readInstant(new Date(Number.NaN))).toBeNull();
  });
});

describe("rowsToEvents", () => {
  test("maps a timed row to a calendar event keyed back to the row", () => {
    const rows = [{ id: "1", title: "Standup", startsAt: new Date(2026, 5, 25, 9, 0) }];
    const { events: out, byId } = rowsToEvents(events, rows, "startsAt", undefined);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "1", title: "Standup", allDay: false });
    expect(byId.get("1")).toBe(rows[0]);
  });

  test("a date-only start becomes an all-day event", () => {
    const rows = [{ id: "1", title: "Launch", on: "2026-06-25" }];
    const { events: out } = rowsToEvents(events, rows, "on", undefined);
    expect(out[0]?.allDay).toBe(true);
  });

  test("a date-only end is made inclusive (pushed to the next midnight)", () => {
    const rows = [{ id: "1", title: "Trip", on: "2026-06-24", to: "2026-06-26" }];
    const { events: out } = rowsToEvents(events, rows, "on", "to");
    // 2026-06-26 (inclusive) → exclusive end at 2026-06-27 00:00.
    expect(out[0]?.end?.getDate()).toBe(27);
    expect(out[0]?.end?.getMonth()).toBe(5);
  });

  test("builds meta lines from cardFields (label: value), skipping unknown keys", () => {
    const rows = [
      {
        id: "1",
        title: "Demo",
        startsAt: new Date(2026, 5, 25, 9, 0),
        endsAt: new Date(2026, 5, 25, 10, 0),
      },
    ];
    const { events: out } = rowsToEvents(events, rows, "startsAt", undefined, ["endsAt", "nope"]);
    // "endsAt" resolves to a label:value line; "nope" (not a field) is skipped.
    expect(out[0]?.meta).toHaveLength(1);
    expect(out[0]?.meta?.[0]?.toLowerCase()).toContain("ends at:");
  });

  test("a datetime end is used as-is", () => {
    const end = new Date(2026, 5, 25, 15, 0);
    const rows = [
      { id: "1", title: "Meeting", startsAt: new Date(2026, 5, 25, 14, 0), endsAt: end },
    ];
    const { events: out } = rowsToEvents(events, rows, "startsAt", "endsAt");
    expect(out[0]?.end?.getTime()).toBe(end.getTime());
  });

  test("drops rows without a usable start and falls back to 'Untitled'", () => {
    const rows = [
      { id: "1", title: "", startsAt: new Date(2026, 5, 25, 9, 0) },
      { id: "2", title: "No date", startsAt: null },
    ];
    const { events: out } = rowsToEvents(events, rows, "startsAt", undefined);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "1", title: "Untitled" });
  });
});

describe("CalendarView", () => {
  test("renders the calendar with the mapped event and opens a row on click", () => {
    const onRowClick = mock();
    // Anchor to today so the default month view shows the event.
    const today = new Date();
    const rows = [
      {
        id: "7",
        title: "Demo",
        startsAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
      },
    ];
    render(
      <CalendarView.Root
        collection={events}
        rows={rows}
        startField="startsAt"
        onRowClick={onRowClick}
      />,
    );
    // The shared calendar toolbar is present…
    expect(screen.getByRole("button", { name: "Today" })).toBeDefined();
    // …and the event chip opens its row.
    fireEvent.click(screen.getByText(/Demo/));
    expect(onRowClick.mock.calls[0]?.[0]).toMatchObject({ id: "7" });
  });

  test("shows the empty message when no row carries a usable date", () => {
    const rows = [{ id: "1", title: "Undated", startsAt: null }];
    render(
      <CalendarView.Root
        collection={events}
        rows={rows}
        startField="startsAt"
        emptyMessage="Nothing scheduled"
      />,
    );
    expect(screen.getByText("Nothing scheduled")).toBeDefined();
  });

  test("exposes the calendar-view slot on its root (calendar and empty state)", () => {
    const today = new Date();
    const rows = [
      {
        id: "7",
        title: "Demo",
        startsAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0),
      },
    ];
    const { baseElement, rerender } = render(
      <CalendarView.Root collection={events} rows={rows} startField="startsAt" />,
    );
    expect(baseElement.querySelector('[data-slot="calendar-view"]')).not.toBeNull();
    rerender(<CalendarView.Root collection={events} rows={[]} startField="startsAt" />);
    expect(baseElement.querySelector('[data-slot="calendar-view"]')).not.toBeNull();
  });
});
