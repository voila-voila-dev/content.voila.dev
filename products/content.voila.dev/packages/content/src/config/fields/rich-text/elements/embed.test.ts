import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { embed } from "./embed";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("embed element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "embed" as const,
      children: [],
      provider: "youtube",
      url: "https://youtube.com/watch?v=abc",
    };
    expect(Schema.decodeUnknownSync(embed.build(node))(value)).toEqual(value);
  });
});
