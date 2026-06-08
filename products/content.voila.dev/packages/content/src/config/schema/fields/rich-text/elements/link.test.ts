import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { link } from "./link";

const node = unknown() as Validator<RichTextNode>;

describe("link element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "link" as const,
      children: [],
      url: "https://example.com",
    };
    expect(decodeSync(link.build(node), value)).toEqual(value);
  });
});
