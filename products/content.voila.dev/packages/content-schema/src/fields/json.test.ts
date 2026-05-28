import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { getFieldMeta } from "../get-field-meta.ts";
import { json } from "./json.ts";

describe("json field", () => {
  it("accepts arbitrary values", () => {
    const f = json();
    expect(Schema.decodeUnknownSync(f)({ a: 1 })).toEqual({ a: 1 });
    expect(Schema.decodeUnknownSync(f)([1, 2, 3])).toEqual([1, 2, 3]);
    expect(Schema.decodeUnknownSync(f)("string")).toBe("string");
    expect(Schema.decodeUnknownSync(f)(null)).toBeNull();
  });

  it("annotation carries default + flags", () => {
    const f = json({ default: { hello: "world" }, required: true, label: "Payload" });
    const meta = getFieldMeta(f);
    expect(meta).toMatchObject({
      kind: "json",
      widget: "json",
      required: true,
      label: "Payload",
      default: { hello: "world" },
    });
  });
});
