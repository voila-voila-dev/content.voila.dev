import { describe, expect, test } from "bun:test";
import type { Value } from "platejs";
import { fromMarkdown, toMarkdown } from "../src/markdown.ts";

/** The E1 node set, in the editor's (Plate) shape. */
const doc: Value = [
  { type: "h1", children: [{ text: "Title" }] },
  { type: "h2", children: [{ text: "Section" }] },
  { type: "h3", children: [{ text: "Sub" }] },
  {
    type: "p",
    children: [
      { text: "Hello " },
      { text: "bold", bold: true },
      { text: " " },
      { text: "italic", italic: true },
      { text: " " },
      { text: "code", code: true },
    ],
  },
  { type: "blockquote", children: [{ text: "a quote" }] },
  {
    type: "ul",
    children: [
      { type: "li", children: [{ type: "lic", children: [{ text: "one" }] }] },
      { type: "li", children: [{ type: "lic", children: [{ text: "two" }] }] },
    ],
  },
  {
    type: "ol",
    children: [{ type: "li", children: [{ type: "lic", children: [{ text: "first" }] }] }],
  },
  {
    type: "p",
    children: [{ text: "see " }, { type: "a", url: "https://x.com", children: [{ text: "link" }] }],
  },
];

describe("toMarkdown", () => {
  test("renders the E1 node set as GFM", () => {
    expect(toMarkdown(doc)).toBe(
      "# Title\n\n" +
        "## Section\n\n" +
        "### Sub\n\n" +
        "Hello **bold** _italic_ `code`\n\n" +
        "> a quote\n\n" +
        "* one\n" +
        "* two\n\n" +
        "1. first\n\n" +
        "see [link](https://x.com)\n",
    );
  });

  test("emits `~~strikethrough~~` under GFM but drops it under CommonMark", () => {
    const struck: Value = [{ type: "p", children: [{ text: "gone", strikethrough: true }] }];
    expect(toMarkdown(struck, { flavor: "gfm" })).toBe("~~gone~~\n");
    // CommonMark has no strikethrough — the text survives, the mark does not.
    expect(toMarkdown(struck, { flavor: "commonmark" })).toBe("gone\n");
  });

  test("drops underline (no markdown spelling) without throwing", () => {
    const u: Value = [{ type: "p", children: [{ text: "plain", underline: true }] }];
    expect(toMarkdown(u, { flavor: "gfm" })).toBe("plain\n");
    expect(toMarkdown(u, { flavor: "commonmark" })).toBe("plain\n");
  });
});

describe("fromMarkdown", () => {
  test("parses headings, marks, lists and links back to the editor shape", () => {
    const value = fromMarkdown("# Title\n\nHello **bold**\n\n* one\n* two\n");
    expect(value).toEqual([
      { type: "h1", children: [{ text: "Title" }] },
      { type: "p", children: [{ text: "Hello " }, { text: "bold", bold: true }] },
      {
        type: "ul",
        children: [
          { type: "li", children: [{ type: "lic", children: [{ text: "one" }] }] },
          { type: "li", children: [{ type: "lic", children: [{ text: "two" }] }] },
        ],
      },
    ] as unknown as Value);
  });

  test("parses `~~strikethrough~~` only under GFM", () => {
    const gfm = fromMarkdown("~~x~~\n", { flavor: "gfm" });
    expect(gfm).toEqual([
      { type: "p", children: [{ text: "x", strikethrough: true }] },
    ] as unknown as Value);
    // Without GFM, `~~` is literal text, not a delete node.
    const cm = fromMarkdown("~~x~~\n", { flavor: "commonmark" });
    expect(cm).toEqual([{ type: "p", children: [{ text: "~~x~~" }] }] as unknown as Value);
  });
});

describe("round-trip", () => {
  test("markdown is stable across parse → serialize (GFM)", () => {
    const md = toMarkdown(doc);
    expect(toMarkdown(fromMarkdown(md))).toBe(md);
  });

  test("markdown is stable across parse → serialize (CommonMark)", () => {
    const md = toMarkdown(doc, { flavor: "commonmark" });
    expect(toMarkdown(fromMarkdown(md, { flavor: "commonmark" }), { flavor: "commonmark" })).toBe(
      md,
    );
  });
});
