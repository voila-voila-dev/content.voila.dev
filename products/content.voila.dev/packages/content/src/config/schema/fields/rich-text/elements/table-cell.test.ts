import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { tableCell } from "./table-cell";

const node = unknown() as Validator<RichTextNode>;

describe("table-cell element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table-cell" as const, children: [] };
    expect(decodeSync(tableCell.build(node), value)).toEqual(value);
  });
});
