import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { kbd } from "./kbd";

describe("kbd mark", () => {
  it("keys as `kbd` and accepts a boolean", () => {
    expect(kbd.key).toBe("kbd");
    expect(decodeSync(kbd.schema, true)).toBe(true);
  });
});
