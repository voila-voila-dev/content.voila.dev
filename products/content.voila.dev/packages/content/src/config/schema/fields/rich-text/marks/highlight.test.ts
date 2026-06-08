import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { highlight } from "./highlight";

describe("highlight mark", () => {
  it("keys as `highlight` and accepts a boolean", () => {
    expect(highlight.key).toBe("highlight");
    expect(decodeSync(highlight.schema, true)).toBe(true);
  });
});
