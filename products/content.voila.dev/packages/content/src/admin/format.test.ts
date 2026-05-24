import { describe, expect, test } from "bun:test";
import { formatDate, formatDateTime, formatNumber } from "./format.ts";

describe("format", () => {
  // Pinned to UTC + en-US so SSR and client output match byte-for-byte
  // regardless of the runtime's timezone (otherwise React hydration throws).
  test("formatDateTime renders the instant in UTC", () => {
    expect(formatDateTime("2026-05-23T14:10:47.873Z")).toBe("May 23, 2026, 2:10 PM UTC");
  });

  test("formatDate drops the time and stays on the UTC calendar day", () => {
    expect(formatDate("2026-05-23T23:30:00.000Z")).toBe("May 23, 2026");
  });

  test("invalid dates fall back to the raw string", () => {
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
  });

  test("formatNumber groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
