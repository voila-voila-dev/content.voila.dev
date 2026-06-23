import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { heading3 } from "./heading-3";

const node = unknown() as Validator<RichTextNode>;

describe("heading-3 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-3" as const, children: [] };
    expect(decodeSync(heading3.build(node), value)).toEqual(value);
  });
});
