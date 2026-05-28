import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { filePlaceholder } from "./file-placeholder";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("file-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "file-placeholder" as const, children: [] };
    expect(Schema.decodeUnknownSync(filePlaceholder.build(node))(value)).toEqual(value);
  });
});
