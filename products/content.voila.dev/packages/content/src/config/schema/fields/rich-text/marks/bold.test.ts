import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { bold } from "./bold";

describe("bold mark", () => {
  it("keys as `bold` and accepts a boolean", () => {
    expect(bold.key).toBe("bold");
    expect(decodeSync(bold.schema, true)).toBe(true);
  });
});
