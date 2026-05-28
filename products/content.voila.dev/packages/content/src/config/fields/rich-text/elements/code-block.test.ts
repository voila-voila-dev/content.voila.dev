import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { codeBlock } from "./code-block";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("code-block element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "code-block" as const, children: [], language: "ts" };
    expect(Schema.decodeUnknownSync(codeBlock.build(node))(value)).toEqual(value);
  });
});
