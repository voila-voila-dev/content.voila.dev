import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { code } from "./code";

describe("code mark", () => {
  it("keys as `code` and accepts a boolean", () => {
    expect(code.key).toBe("code");
    expect(Schema.decodeUnknownSync(code.schema)(true)).toBe(true);
  });
});
