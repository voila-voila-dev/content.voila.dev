import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { underline } from "./underline";

describe("underline mark", () => {
  it("keys as `underline` and accepts a boolean", () => {
    expect(underline.key).toBe("underline");
    expect(decodeSync(underline.schema, true)).toBe(true);
  });
});
