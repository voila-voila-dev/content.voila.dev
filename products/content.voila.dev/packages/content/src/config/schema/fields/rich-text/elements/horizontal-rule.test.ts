import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { horizontalRule } from "./horizontal-rule";

const node = unknown() as Validator<RichTextNode>;

describe("horizontal-rule element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "horizontal-rule" as const, children: [] };
    expect(decodeSync(horizontalRule.build(node), value)).toEqual(value);
  });
});
