import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { blockquote } from "./blockquote";

const node = unknown() as Validator<RichTextNode>;

describe("blockquote element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "blockquote" as const, children: [] };
    expect(decodeSync(blockquote.build(node), value)).toEqual(value);
  });
});
