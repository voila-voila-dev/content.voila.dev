import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import type { RichTextNode } from "../_core";
import { file } from "./file";

const node = Schema.Unknown as unknown as Schema.Schema<RichTextNode>;

describe("file element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "file" as const,
      children: [],
      url: "https://cdn.example.com/report.pdf",
      name: "report.pdf",
    };
    expect(Schema.decodeUnknownSync(file.build(node))(value)).toEqual(value);
  });
});
