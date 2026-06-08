import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { color } from "./color";

describe("color mark", () => {
  it("keys as `color` and accepts a string", () => {
    expect(color.key).toBe("color");
    expect(decodeSync(color.schema, "#ff0000")).toBe("#ff0000");
  });
});
