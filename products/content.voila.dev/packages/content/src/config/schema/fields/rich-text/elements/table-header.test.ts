import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { tableHeader } from "./table-header";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("table-header element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table-header" as const, children: [] };
    expect(Schema.decodeUnknownSync(tableHeader.build(node))(value)).toEqual(value);
  });
});
