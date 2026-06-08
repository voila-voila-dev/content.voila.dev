import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { table } from "./table";

const node = unknown() as Validator<RichTextNode>;

describe("table element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "table" as const, children: [] };
    expect(decodeSync(table.build(node), value)).toEqual(value);
  });
});
