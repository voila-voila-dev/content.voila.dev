import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { fontFamily } from "./font-family";

describe("fontFamily mark", () => {
  it("keys as `fontFamily` and accepts a string", () => {
    expect(fontFamily.key).toBe("fontFamily");
    expect(Schema.decodeUnknownSync(fontFamily.schema)("Inter")).toBe("Inter");
  });
});
