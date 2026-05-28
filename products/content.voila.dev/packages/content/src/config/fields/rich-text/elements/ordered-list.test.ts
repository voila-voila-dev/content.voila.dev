import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { orderedList } from "./ordered-list";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("ordered-list element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "ordered-list" as const, children: [] };
    expect(Schema.decodeUnknownSync(orderedList.build(node))(value)).toEqual(value);
  });
});
