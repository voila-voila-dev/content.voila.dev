import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { embed } from "./embed";

const node = unknown() as Validator<RichTextNode>;

describe("embed element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "embed" as const,
      children: [],
      provider: "youtube",
      url: "https://youtube.com/watch?v=abc",
    };
    expect(decodeSync(embed.build(node), value)).toEqual(value);
  });
});
