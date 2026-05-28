import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { mention } from "./mention";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("mention element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "mention" as const,
      children: [],
      source: "users",
      value: "u-42",
    };
    expect(Schema.decodeUnknownSync(mention.build(node))(value)).toEqual(value);
  });
});
