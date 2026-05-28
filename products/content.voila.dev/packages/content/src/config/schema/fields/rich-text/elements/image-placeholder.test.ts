import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { imagePlaceholder } from "./image-placeholder";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("image-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "image-placeholder" as const, children: [] };
    expect(Schema.decodeUnknownSync(imagePlaceholder.build(node))(value)).toEqual(value);
  });
});
