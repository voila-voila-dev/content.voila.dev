import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { heading2 } from "./heading-2";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("heading-2 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-2" as const, children: [] };
    expect(Schema.decodeUnknownSync(heading2.build(node))(value)).toEqual(value);
  });
});
