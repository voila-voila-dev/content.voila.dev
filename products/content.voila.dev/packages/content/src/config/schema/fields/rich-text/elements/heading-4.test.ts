import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { heading4 } from "./heading-4";

const node = unknown() as Validator<RichTextNode>;

describe("heading-4 element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "heading-4" as const, children: [] };
    expect(decodeSync(heading4.build(node), value)).toEqual(value);
  });
});
