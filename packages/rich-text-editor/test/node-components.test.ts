import { describe, expect, test } from "bun:test";
import { nodeComponents } from "../src/nodes/index.ts";

describe("nodeComponents", () => {
  test("registers a component for every default node type", () => {
    // Plugin keys for the `basicPlugins` set.
    const expected = [
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "code",
      "h1",
      "h2",
      "h3",
      "blockquote",
      "a",
      "ul",
      "ol",
      "li",
      "lic",
    ];
    for (const key of expected) {
      expect(typeof nodeComponents[key]).toBe("function");
    }
  });
});
