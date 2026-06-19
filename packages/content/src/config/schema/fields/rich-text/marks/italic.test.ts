import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { italic } from "./italic";

describe("italic mark", () => {
  it("keys as `italic` and accepts a boolean", () => {
    expect(italic.key).toBe("italic");
    expect(decodeSync(italic.schema, true)).toBe(true);
  });
});
