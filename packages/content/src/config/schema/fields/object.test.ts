import { describe, expect, it } from "bun:test";
import { decodeSync, num, str } from "../std";
import { object } from "./object";

describe("fields.object", () => {
  it("decodes a struct and lists its keys in meta", () => {
    const f = object({ city: str(), zip: num() });
    expect(decodeSync(f, { city: "Paris", zip: 75001 })).toEqual({ city: "Paris", zip: 75001 });
    expect(f.meta.kind).toBe("object");
    expect(f.meta.keys).toEqual(["city", "zip"]);
  });

  it("rejects a value missing a required key", () => {
    const f = object({ city: str() });
    expect(() => decodeSync(f, {})).toThrow();
  });
});
