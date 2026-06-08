import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { strikethrough } from "./strikethrough";

describe("strikethrough mark", () => {
  it("keys as `strikethrough` and accepts a boolean", () => {
    expect(strikethrough.key).toBe("strikethrough");
    expect(decodeSync(strikethrough.schema, true)).toBe(true);
  });
});
