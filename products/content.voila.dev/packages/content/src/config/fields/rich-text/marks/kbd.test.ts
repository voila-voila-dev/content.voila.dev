import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { kbd } from "./kbd";

describe("kbd mark", () => {
  it("keys as `kbd` and accepts a boolean", () => {
    expect(kbd.key).toBe("kbd");
    expect(Schema.decodeUnknownSync(kbd.schema)(true)).toBe(true);
  });
});
