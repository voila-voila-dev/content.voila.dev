import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { orderedList } from "./ordered-list";

const node = unknown() as Validator<RichTextNode>;

describe("ordered-list element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "ordered-list" as const, children: [] };
    expect(decodeSync(orderedList.build(node), value)).toEqual(value);
  });
});
