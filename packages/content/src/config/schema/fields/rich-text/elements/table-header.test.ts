import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { tableHeader } from "./table-header";

const node = unknown() as Validator<RichTextNode>;

describe("table-header element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table-header" as const, children: [] };
    expect(decodeSync(tableHeader.build(node), value)).toEqual(value);
  });
});
