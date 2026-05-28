import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { video } from "./video";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("video element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "video" as const,
      children: [],
      url: "https://cdn.example.com/clip.mp4",
    };
    expect(Schema.decodeUnknownSync(video.build(node))(value)).toEqual(value);
  });
});
