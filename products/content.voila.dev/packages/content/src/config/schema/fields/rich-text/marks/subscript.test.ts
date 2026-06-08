import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { subscript } from "./subscript";

describe("subscript mark", () => {
  it("keys as `subscript` and accepts a boolean", () => {
    expect(subscript.key).toBe("subscript");
    expect(decodeSync(subscript.schema, true)).toBe(true);
  });
});
