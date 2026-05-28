import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { fontSize } from "./font-size";

describe("fontSize mark", () => {
  it("keys as `fontSize` and accepts a string", () => {
    expect(fontSize.key).toBe("fontSize");
    expect(Schema.decodeUnknownSync(fontSize.schema)("14px")).toBe("14px");
  });
});
