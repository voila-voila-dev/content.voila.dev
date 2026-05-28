import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { horizontalRule } from "./horizontal-rule";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("horizontal-rule element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "horizontal-rule" as const, children: [] };
    expect(Schema.decodeUnknownSync(horizontalRule.build(node))(value)).toEqual(value);
  });
});
