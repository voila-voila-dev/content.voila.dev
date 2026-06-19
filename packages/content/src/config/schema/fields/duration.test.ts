import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { duration } from "./duration";

describe("fields.duration", () => {
  it("decodes a non-negative integer number of seconds", () => {
    const f = duration();
    expect(decodeSync(f, 3600)).toBe(3600);
    expect(decodeSync(f, 0)).toBe(0);
    expect(f.meta.kind).toBe("duration");
  });

  it("rejects negative and non-integer values", () => {
    const f = duration();
    expect(() => decodeSync(f, -1)).toThrow();
    expect(() => decodeSync(f, 1.5)).toThrow();
  });
});
