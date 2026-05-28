import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { paragraph } from "./paragraph";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("paragraph element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "paragraph" as const, children: [] };
    expect(Schema.decodeUnknownSync(paragraph.build(node))(value)).toEqual(value);
  });
});
