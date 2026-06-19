import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { heading5 } from "./heading-5";

const node = unknown() as Validator<RichTextNode>;

describe("heading-5 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-5" as const, children: [] };
    expect(decodeSync(heading5.build(node), value)).toEqual(value);
  });
});
