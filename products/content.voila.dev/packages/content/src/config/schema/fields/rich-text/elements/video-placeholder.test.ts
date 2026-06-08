import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { videoPlaceholder } from "./video-placeholder";

const node = unknown() as Validator<RichTextNode>;

describe("video-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "video-placeholder" as const, children: [] };
    expect(decodeSync(videoPlaceholder.build(node), value)).toEqual(value);
  });
});
