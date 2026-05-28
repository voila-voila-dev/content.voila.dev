import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { link } from "./link";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("link element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "link" as const,
      children: [],
      url: "https://example.com",
    };
    expect(Schema.decodeUnknownSync(link.build(node))(value)).toEqual(value);
  });
});
