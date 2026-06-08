import { describe, expect, it } from "bun:test";
import { decodeSync, unknown, type Validator } from "../../../std";
import type { RichTextNode } from "../_core";
import { file } from "./file";

const node = unknown() as Validator<RichTextNode>;

describe("file element", () => {
  it("decodes a minimal value", () => {
    const value = {
      id: "1",
      type: "file" as const,
      children: [],
      url: "https://cdn.example.com/report.pdf",
      name: "report.pdf",
    };
    expect(decodeSync(file.build(node), value)).toEqual(value);
  });
});
