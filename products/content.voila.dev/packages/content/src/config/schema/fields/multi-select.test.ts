import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { multiSelect } from "./multi-select";

describe("fields.multiSelect", () => {
  it("decodes a subset of the options", () => {
    const f = multiSelect({ options: ["a", "b", "c"] });
    expect(decodeSync(f, ["a", "c"])).toEqual(["a", "c"]);
    expect(f.meta.kind).toBe("multiSelect");
    expect(f.meta.options).toEqual(["a", "b", "c"]);
  });

  it("enforces min/max item counts", () => {
    const f = multiSelect({ options: ["a", "b", "c"], min: 1, max: 2 });
    expect(decodeSync(f, ["a"])).toEqual(["a"]);
    expect(() => decodeSync(f, [])).toThrow();
    expect(() => decodeSync(f, ["a", "b", "c"])).toThrow();
  });

  it("rejects values outside the options", () => {
    const f = multiSelect({ options: ["a"] });
    expect(() => decodeSync(f, ["z"])).toThrow();
  });

  it("throws when constructed with no options", () => {
    expect(() => multiSelect({ options: [] })).toThrow(/at least one option/);
  });
});
