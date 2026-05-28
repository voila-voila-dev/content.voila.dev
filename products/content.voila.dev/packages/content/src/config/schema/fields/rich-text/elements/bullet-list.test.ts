import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { bulletList } from "./bullet-list";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("bullet-list element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "bullet-list" as const, children: [] };
    expect(Schema.decodeUnknownSync(bulletList.build(node))(value)).toEqual(value);
  });
});
