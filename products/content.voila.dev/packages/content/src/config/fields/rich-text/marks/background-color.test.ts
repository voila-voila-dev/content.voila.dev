import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { backgroundColor } from "./background-color";

describe("backgroundColor mark", () => {
  it("keys as `backgroundColor` and accepts a string", () => {
    expect(backgroundColor.key).toBe("backgroundColor");
    expect(Schema.decodeUnknownSync(backgroundColor.schema)("yellow")).toBe("yellow");
  });
});
