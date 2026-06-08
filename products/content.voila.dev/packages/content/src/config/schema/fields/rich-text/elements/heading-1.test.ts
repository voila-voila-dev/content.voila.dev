import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { heading1 } from "./heading-1";

const node = unknown() as Validator<RichTextNode>;

describe("heading-1 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-1" as const, children: [] };
    expect(decodeSync(heading1.build(node), value)).toEqual(value);
  });
});
