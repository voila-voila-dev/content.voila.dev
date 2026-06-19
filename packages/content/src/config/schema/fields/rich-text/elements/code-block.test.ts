import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { codeBlock } from "./code-block";

const node = unknown() as Validator<RichTextNode>;

describe("code-block element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "code-block" as const, children: [], language: "ts" };
    expect(decodeSync(codeBlock.build(node), value)).toEqual(value);
  });
});
