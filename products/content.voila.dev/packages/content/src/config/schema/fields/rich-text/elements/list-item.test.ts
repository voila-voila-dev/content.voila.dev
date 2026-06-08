import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { listItem } from "./list-item";

const node = unknown() as Validator<RichTextNode>;

describe("list-item element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "list-item" as const, children: [] };
    expect(decodeSync(listItem.build(node), value)).toEqual(value);
  });
});
