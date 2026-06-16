import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { derivePlugins } from "../../src/content/capabilities.ts";
import { fromWire } from "../../src/content/wire.ts";
import { RichTextEditor } from "../../src/editor.tsx";

describe("UnsupportedElement", () => {
  test("renders a labelled read-only block for a preserved unknown node", () => {
    const { plugins, components } = derivePlugins(["paragraph"], []);
    const value = fromWire([
      { id: "p", type: "paragraph", children: [{ text: "before" }] },
      {
        id: "t",
        type: "table",
        children: [
          {
            id: "r",
            type: "table-row",
            children: [{ id: "c", type: "table-cell", children: [{ text: "x" }] }],
          },
        ],
      },
    ]);
    const { container } = render(
      <RichTextEditor value={value} plugins={plugins} components={components} readOnly />,
    );
    const block = container.querySelector(".voila-rich-text-unsupported");
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain("table — not editable here");
  });
});
