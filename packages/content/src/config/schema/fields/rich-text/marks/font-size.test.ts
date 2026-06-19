import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { fontSize } from "./font-size";

describe("fontSize mark", () => {
  it("keys as `fontSize` and accepts a string", () => {
    expect(fontSize.key).toBe("fontSize");
    expect(decodeSync(fontSize.schema, "14px")).toBe("14px");
  });
});
