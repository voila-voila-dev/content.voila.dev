import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { FieldMetaBase } from "@voila/content";
import { RichTextDisplay } from "./rich-text-display";

afterEach(cleanup);

const meta: FieldMetaBase = { kind: "richText" };

describe("RichTextDisplay", () => {
  test("renders formatted, escaped HTML for a document", () => {
    const doc = [
      { id: "1", type: "heading-1", children: [{ text: "Title" }] },
      {
        id: "2",
        type: "paragraph",
        children: [{ text: "Hi " }, { text: "bold", bold: true }],
      },
    ];
    const { container } = render(<RichTextDisplay value={doc} meta={meta} />);
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector(".voila-rich-text")).not.toBeNull();
  });

  test("renders an em-dash for empty and non-array values", () => {
    expect(render(<RichTextDisplay value={[]} meta={meta} />).container.textContent).toBe("—");
    expect(render(<RichTextDisplay value={null} meta={meta} />).container.textContent).toBe("—");
  });
});
