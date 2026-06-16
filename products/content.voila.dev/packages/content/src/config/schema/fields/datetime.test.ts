import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { datetime } from "./datetime";

describe("fields.datetime", () => {
  it("decodes epoch milliseconds to a Date", () => {
    const f = datetime();
    const decoded = decodeSync(f, 0);
    expect(decoded).toBeInstanceOf(Date);
    expect(decoded.getTime()).toBe(0);
    expect(f.meta.kind).toBe("datetime");
  });

  it("passes an existing Date through", () => {
    const f = datetime();
    const d = new Date(1_000);
    expect(decodeSync(f, d)).toBe(d);
  });

  it("decodes an ISO-8601 string to a Date", () => {
    const f = datetime();
    // What `JSON.stringify(new Date(...))` puts on the wire from the client.
    const decoded = decodeSync(f, "2026-06-08T10:30:00.000Z");
    expect(decoded).toBeInstanceOf(Date);
    expect(decoded.getTime()).toBe(Date.parse("2026-06-08T10:30:00.000Z"));
    // Date-only ISO strings parse too (UTC midnight).
    expect(decodeSync(f, "2026-06-08").getTime()).toBe(Date.parse("2026-06-08"));
  });

  it("rejects non-finite numbers, unparseable strings, and other types", () => {
    const f = datetime();
    expect(() => decodeSync(f, Number.NaN)).toThrow();
    expect(() => decodeSync(f, "not a date")).toThrow();
    expect(() => decodeSync(f, true)).toThrow();
  });
});
