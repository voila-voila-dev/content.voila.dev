import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { image } from "./image";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("image element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "image" as const,
      children: [],
      url: "https://cdn.example.com/cat.webp",
    };
    expect(Schema.decodeUnknownSync(image.build(node))(value)).toEqual(value);
  });
});
