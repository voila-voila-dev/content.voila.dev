import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { tableRow } from "./table-row";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("table-row element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table-row" as const, children: [] };
    expect(Schema.decodeUnknownSync(tableRow.build(node))(value)).toEqual(value);
  });
});
