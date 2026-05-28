import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { heading4 } from "./heading-4";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("heading-4 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-4" as const, children: [] };
    expect(Schema.decodeUnknownSync(heading4.build(node))(value)).toEqual(value);
  });
});
