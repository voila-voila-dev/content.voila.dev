import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { listItem } from "./list-item";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("list-item element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "list-item" as const, children: [] };
    expect(Schema.decodeUnknownSync(listItem.build(node))(value)).toEqual(value);
  });
});
