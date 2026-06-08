import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { tableRow } from "./table-row";

const node = unknown() as Validator<RichTextNode>;

describe("table-row element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table-row" as const, children: [] };
    expect(decodeSync(tableRow.build(node), value)).toEqual(value);
  });
});
