import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { string } from "./string.ts";

describe("string field", () => {
  it("round-trips a valid value", () => {
    const f = string();
    expect(Schema.decodeUnknownSync(f)("hello")).toBe("hello");
    expect(Schema.encodeSync(f)("hello")).toBe("hello");
  });

  it("enforces min length", () => {
    const f = string({ min: 3 });
    expect(() => Schema.decodeUnknownSync(f)("ab")).toThrow();
    expect(Schema.decodeUnknownSync(f)("abc")).toBe("abc");
  });

  it("enforces max length", () => {
    const f = string({ max: 3 });
    expect(() => Schema.decodeUnknownSync(f)("abcd")).toThrow();
    expect(Schema.decodeUnknownSync(f)("abc")).toBe("abc");
  });

  it("rejects non-string input", () => {
    const f = string();
    expect(() => Schema.decodeUnknownSync(f)(42)).toThrow();
  });

  it("attaches a VoilaField annotation with widget+kind+opts", () => {
    const f = string({
      min: 1,
      max: 10,
      unique: true,
      required: true,
      label: "Title",
      description: "The title",
      default: "Untitled",
      localized: true,
    });
    const meta = getFieldMeta(f);
    expect(meta).not.toBeNull();
    expect(meta?.kind).toBe("string");
    expect(meta?.widget).toBe("string");
    expect(meta).toMatchObject({
      kind: "string",
      widget: "string",
      min: 1,
      max: 10,
      unique: true,
      required: true,
      label: "Title",
      description: "The title",
      default: "Untitled",
      localized: true,
    });
  });

  it("defaults to no constraints / undefined opts", () => {
    const f = string();
    const meta = getFieldMeta(f);
    expect(meta?.kind).toBe("string");
    expect(Schema.decodeUnknownSync(f)("")).toBe("");
  });
});
