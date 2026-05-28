import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { underline } from "./underline";

describe("underline mark", () => {
  it("keys as `underline` and accepts a boolean", () => {
    expect(underline.key).toBe("underline");
    expect(Schema.decodeUnknownSync(underline.schema)(true)).toBe(true);
  });
});
