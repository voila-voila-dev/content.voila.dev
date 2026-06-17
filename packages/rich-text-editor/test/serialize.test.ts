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

  test("a block image renders as a figure; its caption is the flattened text", () => {
    const withImage: Value = [
      {
        type: "image",
        url: "https://cdn.example.com/p.png?a=1&b=2",
        alt: 'A "nice" photo',
        caption: "Fig. 1",
        children: [{ text: "" }],
      },
    ];
    expect(toHtml(withImage)).toBe(
      '<figure class="voila-rich-text-image">' +
        '<img src="https://cdn.example.com/p.png?a=1&amp;b=2" alt="A &quot;nice&quot; photo" />' +
        "<figcaption>Fig. 1</figcaption>" +
        "</figure>",
    );
    expect(toPlainText(withImage)).toBe("Fig. 1");
  });

  test("an upload placeholder renders nothing statically", () => {
    const withPlaceholder: Value = [
      { type: "image_placeholder", filename: "x.png", children: [{ text: "" }] },
    ];
    expect(toHtml(withPlaceholder)).toBe("");
    expect(toPlainText(withPlaceholder)).toBe("");
  });

  test("an inline mention renders as a labelled span, not the empty void child", () => {
    const withMention: Value = [
      {
        type: "p",
        children: [
          { text: "Hi " },
          { type: "mention", value: "ada", label: "Ada Lovelace", children: [{ text: "" }] },
        ],
      },
    ];
    expect(toHtml(withMention)).toBe(
      '<p>Hi <span class="voila-rich-text-mention" data-mention="ada">@Ada Lovelace</span></p>',
    );
    expect(toPlainText(withMention)).toBe("Hi @Ada Lovelace");
  });
});
