import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { superscript } from "./superscript";

describe("superscript mark", () => {
  it("keys as `superscript` and accepts a boolean", () => {
    expect(superscript.key).toBe("superscript");
    expect(decodeSync(superscript.schema, true)).toBe(true);
  });
});
