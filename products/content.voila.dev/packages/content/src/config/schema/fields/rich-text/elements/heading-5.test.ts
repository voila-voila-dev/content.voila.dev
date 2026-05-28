import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { heading5 } from "./heading-5";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("heading-5 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-5" as const, children: [] };
    expect(Schema.decodeUnknownSync(heading5.build(node))(value)).toEqual(value);
  });
});
