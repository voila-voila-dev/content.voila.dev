import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { italic } from "./italic";

describe("italic mark", () => {
  it("keys as `italic` and accepts a boolean", () => {
    expect(italic.key).toBe("italic");
    expect(Schema.decodeUnknownSync(italic.schema)(true)).toBe(true);
  });
});
