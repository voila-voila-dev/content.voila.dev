import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { filePlaceholder } from "./file-placeholder";

const node = unknown() as Validator<RichTextNode>;

describe("file-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "file-placeholder" as const, children: [] };
    expect(decodeSync(filePlaceholder.build(node), value)).toEqual(value);
  });
});
