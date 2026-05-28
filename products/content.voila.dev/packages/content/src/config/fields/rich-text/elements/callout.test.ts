import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { callout } from "./callout";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("callout element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "callout" as const,
      children: [],
      icon: "💡",
      bgColor: "#fff7d6",
    };
    expect(Schema.decodeUnknownSync(callout.build(node))(value)).toEqual(value);
  });
});
