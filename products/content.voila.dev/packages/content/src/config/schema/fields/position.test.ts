import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { position } from "./position";

describe("fields.position", () => {
  it("decodes a latitude/longitude pair", () => {
    const f = position();
    expect(decodeSync(f, { latitude: 48.8566, longitude: 2.3522 })).toEqual({
      latitude: 48.8566,
      longitude: 2.3522,
    });
    expect(f.meta.kind).toBe("position");
  });

  it("rejects coordinates outside their ranges", () => {
    const f = position();
    expect(() => decodeSync(f, { latitude: 91, longitude: 0 })).toThrow();
    expect(() => decodeSync(f, { latitude: 0, longitude: 181 })).toThrow();
  });
});
