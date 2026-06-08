import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { mention } from "./mention";

const node = unknown() as Validator<RichTextNode>;

describe("mention element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "mention" as const,
      children: [],
      source: "users",
      value: "u-42",
    };
    expect(decodeSync(mention.build(node), value)).toEqual(value);
  });
});
