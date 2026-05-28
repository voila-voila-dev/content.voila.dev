import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { highlight } from "./highlight";

describe("highlight mark", () => {
  it("keys as `highlight` and accepts a boolean", () => {
    expect(highlight.key).toBe("highlight");
    expect(Schema.decodeUnknownSync(highlight.schema)(true)).toBe(true);
  });
});
