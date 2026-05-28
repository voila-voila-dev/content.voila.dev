import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { string } from "./fields/string.ts";
import { getFieldMeta } from "./get-field-meta.ts";

describe("getFieldMeta", () => {
  it("returns the VoilaField meta when present", () => {
    const f = string({ label: "T" });
    const meta = getFieldMeta(f);
    expect(meta?.kind).toBe("string");
    expect(meta?.label).toBe("T");
  });

  it("returns null when the schema has no VoilaField annotation", () => {
    const bare = Schema.String;
    expect(getFieldMeta(bare)).toBeNull();
  });
});
