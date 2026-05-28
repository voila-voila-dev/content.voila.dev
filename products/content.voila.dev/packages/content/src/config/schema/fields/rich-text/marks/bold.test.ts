import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { bold } from "./bold";

describe("bold mark", () => {
  it("keys as `bold` and accepts a boolean", () => {
    expect(bold.key).toBe("bold");
    expect(Schema.decodeUnknownSync(bold.schema)(true)).toBe(true);
  });
});
