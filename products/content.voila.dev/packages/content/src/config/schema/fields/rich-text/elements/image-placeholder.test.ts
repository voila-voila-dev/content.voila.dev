import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { imagePlaceholder } from "./image-placeholder";

const node = unknown() as Validator<RichTextNode>;

describe("image-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "image-placeholder" as const, children: [] };
    expect(decodeSync(imagePlaceholder.build(node), value)).toEqual(value);
  });
});
