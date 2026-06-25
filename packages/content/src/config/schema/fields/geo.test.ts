import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { geo } from "./geo";

describe("fields.geo", () => {
  it("decodes a { lat, lng } point and carries the geo meta", () => {
    const f = geo();
    expect(decodeSync(f, { lat: 48.85, lng: 2.35 })).toEqual({ lat: 48.85, lng: 2.35 });
    expect(f.meta.kind).toBe("geo");
  });

  it("rejects a value missing a coordinate or with a non-number", () => {
    const f = geo();
    expect(() => decodeSync(f, { lat: 1 })).toThrow();
    expect(() => decodeSync(f, { lat: "x", lng: 2 })).toThrow();
  });

  it("supports required/hidden options via the common base", () => {
    const f = geo({ required: true, hidden: true });
    expect(f.meta.required).toBe(true);
    expect(f.meta.hidden).toBe(true);
  });
});
