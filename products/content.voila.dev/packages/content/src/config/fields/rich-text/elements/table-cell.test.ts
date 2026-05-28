import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { tableCell } from "./table-cell";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("table-cell element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table-cell" as const, children: [] };
    expect(Schema.decodeUnknownSync(tableCell.build(node))(value)).toEqual(value);
  });
});
