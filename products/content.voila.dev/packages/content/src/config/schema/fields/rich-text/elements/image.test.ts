import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { image } from "./image";

const node = unknown() as Validator<RichTextNode>;

describe("image element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "image" as const,
      children: [],
      url: "https://cdn.example.com/cat.webp",
    };
    expect(decodeSync(image.build(node), value)).toEqual(value);
  });
});
