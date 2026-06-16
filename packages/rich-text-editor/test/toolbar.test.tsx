import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { fields } from "@voila/content";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { derivePlugins, deriveToolbar } from "../src/content/capabilities.ts";
import { RichTextToolbar } from "../src/toolbar.tsx";

afterEach(cleanup);

const field = fields.richText() as unknown as {
  meta: { elements: ReadonlyArray<string>; marks: ReadonlyArray<string> };
};
const { elements, marks } = field.meta;

/** Presses a toolbar button, flushing the editor store's async re-render. */
async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.mouseDown(button);
  });
}

/**
 * Mounts the toolbar inside a real Plate provider over a one-paragraph doc.
 * Pass `editable` to also mount `<PlateContent>` so store changes flush back to
 * the toolbar's selectors (needed only when asserting reactive `aria-pressed`).
 */
function mountToolbar(
  model = deriveToolbar(elements, marks),
  { editable = false, readOnly = false } = {},
) {
  const { plugins, components } = derivePlugins(elements, marks);
  const editor = createPlateEditor({
    plugins,
    components,
    value: [{ type: "p", children: [{ text: "hello" }] }],
    selection: {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 5 },
    },
  });
  const utils = render(
    <Plate editor={editor} readOnly={readOnly}>
      <RichTextToolbar model={model} />
      {editable ? <PlateContent /> : null}
    </Plate>,
  );
  return { editor, ...utils };
}

describe("RichTextToolbar — structure", () => {
  test("renders a labelled toolbar landmark with one button per control", () => {
    const { getByRole, getByLabelText } = mountToolbar();
    const toolbar = getByRole("toolbar");
    expect(toolbar.getAttribute("aria-label")).toBe("Formatting");
    for (const label of ["Heading 1", "Bold", "Italic", "Bulleted list", "Numbered list"]) {
      expect(getByLabelText(label).tagName).toBe("BUTTON");
    }
  });

  test("a restricted model renders only the allowed controls", () => {
    const { queryByLabelText } = mountToolbar(deriveToolbar(["paragraph"], ["bold"]));
    expect(queryByLabelText("Bold")).not.toBeNull();
    expect(queryByLabelText("Heading 1")).toBeNull();
    expect(queryByLabelText("Bulleted list")).toBeNull();
  });

  test("an empty model renders nothing", () => {
    const { container } = mountToolbar(deriveToolbar([], []));
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });
});

describe("RichTextToolbar — interaction", () => {
  test("clicking a mark toggles it on the current selection", async () => {
    const { editor, getByLabelText } = mountToolbar();
    expect(editor.api.hasMark("bold")).toBeFalsy();
    await press(getByLabelText("Bold"));
    expect(editor.api.hasMark("bold")).toBe(true);
    await press(getByLabelText("Bold"));
    expect(editor.api.hasMark("bold")).toBeFalsy();
  });

  test("clicking a block control turns the current block into that type", async () => {
    const { editor, getByLabelText } = mountToolbar();
    await press(getByLabelText("Heading 2"));
    expect(editor.api.block()?.[0]?.type).toBe("h2");
  });

  test("clicking a list control wraps the block into a list", async () => {
    const { editor, getByLabelText } = mountToolbar();
    await press(getByLabelText("Bulleted list"));
    expect(editor.children[0]?.type).toBe("ul");
  });

  test("a read-only editor disables the buttons and ignores presses", async () => {
    const { editor, getByLabelText } = mountToolbar(undefined, { readOnly: true });
    const bold = getByLabelText("Bold") as HTMLButtonElement;
    expect(bold.disabled).toBe(true);
    await press(bold);
    expect(editor.api.hasMark("bold")).toBeFalsy();
  });

  test("the active control reflects the current selection via aria-pressed", async () => {
    const { getByLabelText } = mountToolbar(undefined, { editable: true });
    const bold = getByLabelText("Bold");
    expect(bold.getAttribute("aria-pressed")).toBe("false");
    await press(bold);
    // The button re-renders from the editor store once the change flushes.
    await waitFor(() => expect(bold.getAttribute("aria-pressed")).toBe("true"));
  });
});
