import { describe, expect, it } from "bun:test";
import { decodeSync } from "../../../std";
import { fontFamily } from "./font-family";

describe("fontFamily mark", () => {
  it("keys as `fontFamily` and accepts a string", () => {
    expect(fontFamily.key).toBe("fontFamily");
    expect(decodeSync(fontFamily.schema, "Inter")).toBe("Inter");
  });
});
