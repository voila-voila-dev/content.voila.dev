import { describe, expect, test } from "bun:test";
import type { Value } from "platejs";
import { toHtml, toJson, toPlainText } from "../src/serialize.ts";

const doc: Value = [
  { type: "h1", children: [{ text: "Title" }] },
  {
    type: "p",
    children: [{ text: "Hello " }, { text: "world", bold: true, italic: true }],
  },
  {
    type: "ul",
    children: [
      {
        type: "li",
        children: [{ type: "lic", children: [{ text: "first" }] }],
      },
    ],
  },
  { type: "a", url: 'https://example.com/?a=1&b="x"', children: [{ text: "link" }] },
  { type: "p", children: [{ text: "1 < 2 & 3 > 0" }] },
];

describe("serialize", () => {
  test("toHtml maps nodes and nests marks", () => {
    expect(toHtml(doc)).toBe(
      "<h1>Title</h1>" +
        "<p>Hello <em><strong>world</strong></em></p>" +
        "<ul><li>first</li></ul>" +
        '<a href="https://example.com/?a=1&amp;b=&quot;x&quot;">link</a>' +
        "<p>1 &lt; 2 &amp; 3 &gt; 0</p>",
    );
  });

  test("toPlainText flattens to one line per block", () => {
    expect(toPlainText(doc)).toBe("Title\nHello world\nfirst\nlink\n1 < 2 & 3 > 0");
  });

  test("toJson is the identity document", () => {
    expect(toJson(doc)).toBe(doc);
  });
});
