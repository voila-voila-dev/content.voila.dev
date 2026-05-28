import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { SLUG_PATTERN, slug } from "./slug.ts";

describe("slug field", () => {
  it("accepts URL-safe slugs", () => {
    const f = slug();
    expect(Schema.decodeUnknownSync(f)("hello-world")).toBe("hello-world");
    expect(Schema.decodeUnknownSync(f)("post-1")).toBe("post-1");
    expect(Schema.decodeUnknownSync(f)("abc")).toBe("abc");
  });

  it("rejects invalid characters", () => {
    const f = slug();
    expect(() => Schema.decodeUnknownSync(f)("Hello")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("hello world")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("hello_world")).toThrow();
    expect(() => Schema.decodeUnknownSync(f)("")).toThrow();
  });

  it("exports the slug pattern", () => {
    expect(SLUG_PATTERN.test("hello-1")).toBe(true);
    expect(SLUG_PATTERN.test("Hello")).toBe(false);
  });

  it("carries unique + derivedFrom in meta", () => {
    const f = slug({ unique: true, derivedFrom: "title", required: true, label: "Slug" });
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "slug",
      widget: "slug",
      unique: true,
      derivedFrom: "title",
      required: true,
      label: "Slug",
    });
  });
});
