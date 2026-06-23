import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { time } from "./time";

describe("fields.time", () => {
  it("decodes a 24h HH:MM:SS string", () => {
    const f = time();
    expect(decodeSync(f, "23:59:59")).toBe("23:59:59");
    expect(f.meta.kind).toBe("time");
  });

  it("rejects out-of-range or malformed times", () => {
    const f = time();
    expect(() => decodeSync(f, "24:00:00")).toThrow();
    expect(() => decodeSync(f, "9:00")).toThrow();
  });
});
