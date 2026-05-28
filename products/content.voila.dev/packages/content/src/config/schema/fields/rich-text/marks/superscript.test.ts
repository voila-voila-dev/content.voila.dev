import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { superscript } from "./superscript";

describe("superscript mark", () => {
  it("keys as `superscript` and accepts a boolean", () => {
    expect(superscript.key).toBe("superscript");
    expect(Schema.decodeUnknownSync(superscript.schema)(true)).toBe(true);
  });
});
