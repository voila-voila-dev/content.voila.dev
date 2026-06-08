import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { heading6 } from "./heading-6";

const node = unknown() as Validator<RichTextNode>;

describe("heading-6 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-6" as const, children: [] };
    expect(decodeSync(heading6.build(node), value)).toEqual(value);
  });
});
