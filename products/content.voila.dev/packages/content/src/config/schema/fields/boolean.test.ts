import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { boolean } from "./boolean";

describe("fields.boolean", () => {
  it("decodes a boolean", () => {
    const f = boolean();
    expect(decodeSync(f, true)).toBe(true);
    expect(decodeSync(f, false)).toBe(false);
    expect(f.meta.kind).toBe("boolean");
  });

  it("rejects a non-boolean", () => {
    const f = boolean();
    expect(() => decodeSync(f, "yes")).toThrow();
  });
});
