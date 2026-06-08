import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { enum_ } from "./enum";

describe("fields.enum", () => {
  it("decodes one of the enum's values", () => {
    const f = enum_({ values: { Draft: "draft", Published: "published" } });
    expect(decodeSync(f, "draft")).toBe("draft");
    expect(f.meta.kind).toBe("enum");
    expect(f.meta.widget).toBe("select");
    expect(f.meta.values).toEqual({ Draft: "draft", Published: "published" });
  });

  it("supports numeric enum values", () => {
    const f = enum_({ values: { Low: 1, High: 2 } });
    expect(decodeSync(f, 2)).toBe(2);
  });

  it("rejects values outside the enum", () => {
    const f = enum_({ values: { A: "a" } });
    expect(() => decodeSync(f, "b")).toThrow();
  });

  it("throws on an empty enum", () => {
    expect(() => enum_({ values: {} })).toThrow(/non-empty enum/);
  });
});
