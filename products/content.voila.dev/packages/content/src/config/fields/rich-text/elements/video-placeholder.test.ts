import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { videoPlaceholder } from "./video-placeholder";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("video-placeholder element", () => {
  it("decodes a minimal value", () => {
    const value = { id: "1", type: "video-placeholder" as const, children: [] };
    expect(Schema.decodeUnknownSync(videoPlaceholder.build(node))(value)).toEqual(value);
  });
});
