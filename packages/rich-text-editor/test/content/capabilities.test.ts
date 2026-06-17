import { describe, expect, test } from "bun:test";
import {
  deriveMarkdownPlugins,
  deriveMarkdownToolbar,
  derivePlugins,
  deriveToolbar,
  supportedElements,
  supportedMarks,
} from "../../src/content/capabilities.ts";
import { UNSUPPORTED_TYPE } from "../../src/content/wire.ts";

function pluginKeys(elements: ReadonlyArray<string>, marks: ReadonlyArray<string>): string[] {
  return derivePlugins(elements, marks).plugins.map((p) => (p as { key: string }).key);
}

describe("capabilities — derivePlugins", () => {
  test("always includes node-id tracking and the unsupported-block plugin", () => {
    const keys = pluginKeys([], []);
    expect(keys).toContain("nodeId");
    expect(keys).toContain(UNSUPPORTED_TYPE);
  });

  test("a full field derives every supported plugin plus the implicit `lic` for lists", () => {
    const { plugins, components } = derivePlugins(
      [
        "paragraph",
        "heading-1",
        "heading-2",
        "heading-3",
        "blockquote",
        "bullet-list",
        "ordered-list",
        "list-item",
        "link",
      ],
      ["bold", "italic", "underline", "strikethrough", "code"],
    );
    const keys = plugins.map((p) => (p as { key: string }).key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "p",
        "h1",
        "h2",
        "h3",
        "blockquote",
        "ul",
        "ol",
        "li",
        "lic",
        "a",
        "bold",
        "italic",
        "underline",
        "strikethrough",
        "code",
      ]),
    );
    // Paragraph renders via Plate core (no component); everything else maps one.
    expect(components).not.toHaveProperty("p");
    for (const key of ["h1", "ul", "li", "lic", "a", "bold", UNSUPPORTED_TYPE]) {
      expect(components[key]).toBeDefined();
    }
  });

  test("a restricted field derives a restricted plugin set (no list, no lic)", () => {
    const keys = pluginKeys(["paragraph", "link"], ["bold"]);
    expect(keys).toContain("a");
    expect(keys).toContain("bold");
    expect(keys).not.toContain("ul");
    expect(keys).not.toContain("lic");
    expect(keys).not.toContain("italic");
  });

  test("unknown element and mark kinds are skipped (preserved at the wire layer)", () => {
    const keys = pluginKeys(["paragraph", "table", "heading-9"], ["bold", "rainbow"]);
    expect(keys).toContain("p");
    expect(keys).toContain("bold");
    expect(keys).not.toContain("table");
    expect(keys).not.toContain("heading-9");
    expect(keys).not.toContain("rainbow");
  });
});

describe("capabilities — media", () => {
  const media = { upload: async () => ({ url: "https://cdn/x.png" }) };

  test("renders images read-only when the field allows `image`, even without upload", () => {
    const { plugins, components } = derivePlugins(["paragraph", "image"], []);
    const keys = plugins.map((p) => (p as { key: string }).key);
    expect(keys).toContain("image");
    // No upload → no placeholder (nothing to insert), but images still render.
    expect(keys).not.toContain("image_placeholder");
    expect(components.image).toBeDefined();
  });

  test("wires the placeholder + upload plugins when `media` is supplied", () => {
    const { plugins, components } = derivePlugins(["paragraph", "image"], [], { media });
    const keys = plugins.map((p) => (p as { key: string }).key);
    expect(keys).toContain("image");
    expect(keys).toContain("image_placeholder");
    expect(components.image).toBeDefined();
    expect(components.image_placeholder).toBeDefined();
  });

  test("not wired when the field omits the `image` element kind", () => {
    const keys = derivePlugins(["paragraph"], [], { media }).plugins.map(
      (p) => (p as { key: string }).key,
    );
    expect(keys).not.toContain("image");
    expect(keys).not.toContain("image_placeholder");
  });
});

describe("capabilities — deriveMarkdownPlugins", () => {
  test("derives the markdown-representable node set, with strikethrough only on GFM", () => {
    const gfm = deriveMarkdownPlugins("gfm").plugins.map((p) => (p as { key: string }).key);
    expect(gfm).toEqual(
      expect.arrayContaining(["p", "h1", "h2", "h3", "blockquote", "ul", "ol", "li", "lic", "a"]),
    );
    expect(gfm).toEqual(expect.arrayContaining(["bold", "italic", "code", "strikethrough"]));
    // Underline has no markdown spelling — the editor never offers it.
    expect(gfm).not.toContain("underline");

    const cm = deriveMarkdownPlugins("commonmark").plugins.map((p) => (p as { key: string }).key);
    expect(cm).toContain("bold");
    expect(cm).not.toContain("strikethrough");
    expect(cm).not.toContain("underline");
  });
});

describe("capabilities — deriveToolbar", () => {
  const FULL_ELEMENTS = [
    "paragraph",
    "heading-1",
    "heading-2",
    "heading-3",
    "blockquote",
    "bullet-list",
    "ordered-list",
    "list-item",
    "link",
  ];
  const FULL_MARKS = ["bold", "italic", "underline", "strikethrough", "code"];

  test("a full field yields every block, mark, and list control in display order", () => {
    const { blocks, marks, lists } = deriveToolbar(FULL_ELEMENTS, FULL_MARKS);
    expect(blocks.map((c) => c.wireType)).toEqual([
      "paragraph",
      "heading-1",
      "heading-2",
      "heading-3",
      "blockquote",
    ]);
    expect(marks.map((c) => c.wireType)).toEqual([
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "code",
    ]);
    expect(lists.map((c) => c.wireType)).toEqual(["bullet-list", "ordered-list"]);
    // Controls carry the Plate key the button toggles + a human label.
    expect(blocks[1]).toMatchObject({ control: "block", plateKey: "h1", label: "Heading 1" });
    expect(lists[0]).toMatchObject({ control: "list", plateKey: "ul" });
  });

  test("a restricted field yields only the controls it can persist", () => {
    const { blocks, marks, lists } = deriveToolbar(["paragraph", "link"], ["bold"]);
    expect(blocks.map((c) => c.wireType)).toEqual(["paragraph"]);
    expect(marks.map((c) => c.wireType)).toEqual(["bold"]);
    expect(lists).toHaveLength(0);
  });

  test("unknown kinds never become controls", () => {
    const { blocks, marks } = deriveToolbar(["paragraph", "table"], ["bold", "rainbow"]);
    expect(blocks.map((c) => c.wireType)).toEqual(["paragraph"]);
    expect(marks.map((c) => c.wireType)).toEqual(["bold"]);
  });

  test("markdown toolbar offers strikethrough only on GFM and never underline", () => {
    const gfm = deriveMarkdownToolbar("gfm");
    expect(gfm.marks.map((c) => c.wireType)).toEqual(["bold", "italic", "strikethrough", "code"]);
    expect(gfm.lists.map((c) => c.wireType)).toEqual(["bullet-list", "ordered-list"]);

    const cm = deriveMarkdownToolbar("commonmark");
    expect(cm.marks.map((c) => c.wireType)).toEqual(["bold", "italic", "code"]);
    expect(cm.marks.some((c) => c.wireType === "underline")).toBe(false);
  });
});

describe("capabilities — maps", () => {
  test("supportedElements covers exactly the E1 element subset", () => {
    expect(Object.keys(supportedElements).sort()).toEqual(
      [
        "blockquote",
        "bullet-list",
        "heading-1",
        "heading-2",
        "heading-3",
        "link",
        "list-item",
        "ordered-list",
        "paragraph",
      ].sort(),
    );
  });

  test("supportedMarks covers exactly the E1 mark subset", () => {
    expect(Object.keys(supportedMarks).sort()).toEqual(
      ["bold", "code", "italic", "strikethrough", "underline"].sort(),
    );
  });
});
