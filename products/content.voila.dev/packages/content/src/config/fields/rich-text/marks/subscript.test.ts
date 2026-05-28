import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { subscript } from "./subscript";

describe("subscript mark", () => {
  it("keys as `subscript` and accepts a boolean", () => {
    expect(subscript.key).toBe("subscript");
    expect(Schema.decodeUnknownSync(subscript.schema)(true)).toBe(true);
  });
});
