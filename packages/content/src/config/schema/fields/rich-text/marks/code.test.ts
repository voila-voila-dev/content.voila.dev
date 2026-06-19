import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { code } from "./code";

describe("code mark", () => {
  it("keys as `code` and accepts a boolean", () => {
    expect(code.key).toBe("code");
    expect(decodeSync(code.schema, true)).toBe(true);
  });
});
