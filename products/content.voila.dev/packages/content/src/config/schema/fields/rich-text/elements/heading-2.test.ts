import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { heading2 } from "./heading-2";

const node = unknown() as Validator<RichTextNode>;

describe("heading-2 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-2" as const, children: [] };
    expect(decodeSync(heading2.build(node), value)).toEqual(value);
  });
});
