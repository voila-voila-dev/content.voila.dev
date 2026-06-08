import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { embedPlaceholder } from "./embed-placeholder";

const node = unknown() as Validator<RichTextNode>;

describe("embed-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "embed-placeholder" as const, children: [] };
    expect(decodeSync(embedPlaceholder.build(node), value)).toEqual(value);
  });
});
