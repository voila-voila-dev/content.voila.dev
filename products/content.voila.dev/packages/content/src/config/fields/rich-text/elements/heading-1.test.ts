import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { heading1 } from "./heading-1";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("heading-1 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-1" as const, children: [] };
    expect(Schema.decodeUnknownSync(heading1.build(node))(value)).toEqual(value);
  });
});
