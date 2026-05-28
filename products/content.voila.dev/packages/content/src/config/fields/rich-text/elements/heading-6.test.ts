import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { heading6 } from "./heading-6";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("heading-6 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-6" as const, children: [] };
    expect(Schema.decodeUnknownSync(heading6.build(node))(value)).toEqual(value);
  });
});
