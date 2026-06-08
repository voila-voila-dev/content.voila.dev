import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { paragraph } from "./paragraph";

const node = unknown() as Validator<RichTextNode>;

describe("paragraph element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "paragraph" as const, children: [] };
    expect(decodeSync(paragraph.build(node), value)).toEqual(value);
  });
});
