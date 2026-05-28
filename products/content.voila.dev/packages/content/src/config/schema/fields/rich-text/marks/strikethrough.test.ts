import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { strikethrough } from "./strikethrough";

describe("strikethrough mark", () => {
  it("keys as `strikethrough` and accepts a boolean", () => {
    expect(strikethrough.key).toBe("strikethrough");
    expect(Schema.decodeUnknownSync(strikethrough.schema)(true)).toBe(true);
  });
});
