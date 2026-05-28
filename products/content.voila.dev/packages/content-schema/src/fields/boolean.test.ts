import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { boolean } from "./boolean.ts";

describe("boolean field", () => {
  it("round-trips true and false", () => {
    const f = boolean();
    expect(Schema.decodeUnknownSync(f)(true)).toBe(true);
    expect(Schema.decodeUnknownSync(f)(false)).toBe(false);
    expect(Schema.encodeSync(f)(true)).toBe(true);
  });

  it("rejects non-boolean", () => {
    const f = boolean();
    expect(() => Schema.decodeUnknownSync(f)("yes")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)(1)).toThrow();
  });

  it("annotation carries the default value", () => {
    const f = boolean({ default: true, required: true, label: "Published" });
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "boolean",
      widget: "boolean",
      default: true,
      required: true,
      label: "Published",
    });
  });
});
