import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { embedPlaceholder } from "./embed-placeholder";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("embed-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "embed-placeholder" as const, children: [] };
    expect(Schema.decodeUnknownSync(embedPlaceholder.build(node))(value)).toEqual(value);
  });
});
