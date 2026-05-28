import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { color } from "./color";

describe("color mark", () => {
  it("keys as `color` and accepts a string", () => {
    expect(color.key).toBe("color");
    expect(Schema.decodeUnknownSync(color.schema)("#ff0000")).toBe("#ff0000");
  });
});
