import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { callout } from "./callout";

const node = unknown() as Validator<RichTextNode>;

describe("callout element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "callout" as const,
      children: [],
      icon: "💡",
      bgColor: "#fff7d6",
    };
    expect(decodeSync(callout.build(node), value)).toEqual(value);
  });
});
