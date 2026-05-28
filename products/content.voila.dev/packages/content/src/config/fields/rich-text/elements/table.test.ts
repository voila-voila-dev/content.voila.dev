import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { table } from "./table";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("table element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table" as const, children: [] };
    expect(Schema.decodeUnknownSync(table.build(node))(value)).toEqual(value);
  });
});
