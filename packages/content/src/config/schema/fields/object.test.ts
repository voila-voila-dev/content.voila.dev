import { describe, expect, it } from "bun:test";
import { decodeSync, num, str, validateSync } from "../std";
import { object } from "./object";
import { string } from "./string";

describe("fields.object", () => {
  it("decodes a struct and lists its keys and shape in meta", () => {
    const f = object({ city: str(), zip: num() });
    expect(decodeSync(f, { city: "Paris", zip: 75001 })).toEqual({ city: "Paris", zip: 75001 });
    expect(f.meta.kind).toBe("object");
    expect(f.meta.keys).toEqual(["city", "zip"]);
    expect(Object.keys(f.meta.shape)).toEqual(["city", "zip"]);
  });

  it("rejects a value missing a bare-validator key", () => {
    const f = object({ city: str() });
    expect(() => decodeSync(f, {})).toThrow();
  });

  it("omits a blank optional member field and requires a required one", () => {
    const f = object({ city: string({ required: true }), note: string() });
    expect(decodeSync(f, { city: "Paris", note: "" })).toEqual({ city: "Paris" });
    expect(validateSync(f, { note: "x" }).issues).toEqual([
      { message: "Required.", path: ["city"] },
    ]);
  });

  it("throws when a member is localized", () => {
    expect(() => object({ title: string({ localized: true }) })).toThrow(/cannot be localized/);
  });
});
