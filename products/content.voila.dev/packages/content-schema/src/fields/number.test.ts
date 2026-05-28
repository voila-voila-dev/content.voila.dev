import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { number } from "./number.ts";

describe("number field", () => {
  it("round-trips a valid value", () => {
    const f = number();
    expect(Schema.decodeUnknownSync(f)(3.14)).toBe(3.14);
    expect(Schema.encodeSync(f)(3.14)).toBe(3.14);
  });

  it("enforces min/max", () => {
    const f = number({ min: 0, max: 10 });
    expect(() => Schema.decodeUnknownSync(f)(-1)).toThrow();
    expect(() => Schema.decodeUnknownSync(f)(11)).toThrow();
    expect(Schema.decodeUnknownSync(f)(5)).toBe(5);
  });

  it("enforces integer when set", () => {
    const f = number({ integer: true });
    expect(() => Schema.decodeUnknownSync(f)(3.5)).toThrow();
    expect(Schema.decodeUnknownSync(f)(3)).toBe(3);
  });

  it("rejects non-number input", () => {
    const f = number();
    expect(() => Schema.decodeUnknownSync(f)("3")).toThrow();
  });

  it("attaches a VoilaField annotation with full meta", () => {
    const f = number({
      min: 0,
      max: 100,
      integer: true,
      unique: true,
      index: true,
      required: true,
      label: "Count",
      description: "Word count",
      default: 0,
      localized: false,
    });
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "number",
      widget: "number",
      min: 0,
      max: 100,
      integer: true,
      unique: true,
      index: true,
      required: true,
      label: "Count",
      description: "Word count",
      default: 0,
    });
  });
});
