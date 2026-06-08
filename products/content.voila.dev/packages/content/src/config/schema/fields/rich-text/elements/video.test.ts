import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { video } from "./video";

const node = unknown() as Validator<RichTextNode>;

describe("video element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "video" as const,
      children: [],
      url: "https://cdn.example.com/clip.mp4",
    };
    expect(decodeSync(video.build(node), value)).toEqual(value);
  });
});
