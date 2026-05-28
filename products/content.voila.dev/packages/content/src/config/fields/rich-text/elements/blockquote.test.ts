import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { blockquote } from "./blockquote";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("blockquote element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "blockquote" as const, children: [] };
    expect(Schema.decodeUnknownSync(blockquote.build(node))(value)).toEqual(value);
  });
});
