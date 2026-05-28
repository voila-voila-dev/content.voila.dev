import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { date } from "./date.ts";

describe("date field", () => {
  it("accepts a valid ISO calendar date", () => {
    const f = date();
    expect(Schema.decodeUnknownSync(f)("2024-01-31")).toBe("2024-01-31");
    expect(Schema.encodeSync(f)("2024-01-31")).toBe("2024-01-31");
  });

  it("rejects malformed strings", () => {
    const f = date();
    expect(() => Schema.decodeUnknownSync(f)("2024-1-31")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("2024-01-31T00:00:00Z")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("not a date")).toThrow();
  });

  it("rejects out-of-calendar dates", () => {
    const f = date();
    expect(() => Schema.decodeUnknownSync(f)("2024-02-31")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("2024-13-01")).toThrow();
  });

  it("attaches a VoilaField annotation", () => {
    const f = date({ required: true, label: "Birthday", default: "2000-01-01", localized: false });
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "date",
      widget: "date",
      required: true,
      label: "Birthday",
      default: "2000-01-01",
    });
  });
});
