import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { datetime } from "./datetime.ts";

describe("datetime field", () => {
  it("accepts a valid ISO datetime", () => {
    const f = datetime();
    const v = "2024-01-31T10:00:00.000Z";
    expect(Schema.decodeUnknownSync(f)(v)).toBe(v);
  });

  it("accepts ISO with offset", () => {
    const f = datetime();
    const v = "2024-01-31T10:00:00+02:00";
    expect(Schema.decodeUnknownSync(f)(v)).toBe(v);
  });

  it("rejects calendar-only and free-form strings", () => {
    const f = datetime();
    expect(() => Schema.decodeUnknownSync(f)("2024-01-31")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("yesterday")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("")).toThrow();
  });

  it("attaches a VoilaField annotation", () => {
    const f = datetime({ required: false, label: "Published at" });
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "datetime",
      widget: "datetime",
      required: false,
      label: "Published at",
    });
  });
});
