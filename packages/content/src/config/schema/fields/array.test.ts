import { describe, expect, it } from "bun:test";
import { decodeSync, str, validateSync } from "../std";
import { array } from "./array";
import { media } from "./media";
import { string } from "./string";

describe("fields.array", () => {
  it("decodes a list and keeps the item field in meta", () => {
    const f = array(string({ max: 10 }));
    expect(decodeSync(f, ["a", "b"])).toEqual(["a", "b"]);
    expect(f.meta.kind).toBe("array");
    expect(f.meta.item?.meta.kind).toBe("string");
  });

  it("leaves `item` unset for a bare validator", () => {
    const f = array(str());
    expect(f.meta.item).toBeUndefined();
    expect(decodeSync(f, ["x"])).toEqual(["x"]);
  });

  it("reports item issues under their index", () => {
    const r = validateSync(array(string({ max: 1 })), ["a", "bb"]);
    expect(r.issues?.[0]?.path).toEqual([1]);
  });

  it("honours min / max", () => {
    const f = array(media(), { min: 1, max: 2 });
    expect(validateSync(f, []).issues?.[0]?.message).toMatch(/at least 1/);
    expect(f.meta.min).toBe(1);
    expect(f.meta.max).toBe(2);
  });

  it("throws when the item field is localized", () => {
    expect(() => array(string({ localized: true }))).toThrow(/cannot be localized/);
  });
});
