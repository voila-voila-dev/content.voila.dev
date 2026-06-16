import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { fields } from "@voila/content";
import { createPlateEditor, EventEditorStore, Plate, PlateContent } from "platejs/react";
import { derivePlugins, deriveToolbar } from "../src/content/capabilities.ts";
import { RichTextFloatingToolbar } from "../src/floating-toolbar.tsx";

afterEach(() => {
  cleanup();
  // EventEditorStore is module-global; reset focus so tests don't leak into one another.
  EventEditorStore.set("focus", null);
});

const field = fields.richText() as unknown as {
  meta: { elements: ReadonlyArray<string>; marks: ReadonlyArray<string> };
};
const { elements, marks } = field.meta;

const COLLAPSED = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
const EXPANDED = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 5 } };

/**
 * Mounts the floating toolbar inside a real Plate provider over a one-paragraph
 * doc, with `<PlateContent>` so the editor resolves to DOM (the floating hook
 * measures the selection). It starts *focused with a collapsed selection* — the
 * state from which expanding a selection opens the toolbar (Plate only opens it
 * after a collapsed→expanded transition while the editor is focused).
 */
function mountFloating(model = deriveToolbar(elements, marks), { readOnly = false } = {}) {
  const { plugins, components } = derivePlugins(elements, marks);
  const editor = createPlateEditor({
    plugins,
    components,
    value: [{ type: "p", children: [{ text: "hello" }] }],
    selection: COLLAPSED,
  });
  // Register the editor as the focused one *before* render so the hook sees it
  // focused from the first effect, and clears its "wait for collapsed selection"
  // latch (the collapsed selection does that) — exactly the real focus path.
  EventEditorStore.set("focus", editor.id);
  const utils = render(
    <Plate editor={editor} readOnly={readOnly}>
      <RichTextFloatingToolbar model={model} />
      <PlateContent />
    </Plate>,
  );
  return { editor, ...utils };
}

/** Moves the editor selection, flushing Plate's selectors + the open effect. */
async function selectRange(
  editor: ReturnType<typeof mountFloating>["editor"],
  range: typeof EXPANDED,
) {
  await act(async () => {
    editor.tf.select(range);
  });
}

describe("RichTextFloatingToolbar — visibility", () => {
  test("renders nothing while the selection is collapsed", () => {
    const { container } = mountFloating();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  test("appears over a non-collapsed selection", async () => {
    const { editor, getByRole } = mountFloating();
    await selectRange(editor, EXPANDED);
    await waitFor(() => expect(getByRole("toolbar")).not.toBeNull());
  });

  test("renders nothing for a read-only editor even with a selection", async () => {
    const { editor, container } = mountFloating(undefined, { readOnly: true });
    await selectRange(editor, EXPANDED);
    // Give the open effect a chance to run; it must stay closed for read-only.
    await act(async () => {});
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });
});

describe("RichTextFloatingToolbar — surface", () => {
  test("shows the capability-gated controls with a labelled landmark", async () => {
    const { editor, getByRole, getByLabelText } = mountFloating();
    await selectRange(editor, EXPANDED);
    await waitFor(() => {
      const toolbar = getByRole("toolbar");
      expect(toolbar.getAttribute("aria-label")).toBe("Selection formatting");
      expect(toolbar.getAttribute("aria-orientation")).toBe("horizontal");
    });
    for (const label of ["Heading 1", "Bold", "Italic", "Bulleted list"]) {
      expect(getByLabelText(label).tagName).toBe("BUTTON");
    }
  });

  test("a restricted model floats only the allowed controls", async () => {
    const { editor, queryByLabelText } = mountFloating(deriveToolbar(["paragraph"], ["bold"]));
    await selectRange(editor, EXPANDED);
    await waitFor(() => expect(queryByLabelText("Bold")).not.toBeNull());
    expect(queryByLabelText("Heading 1")).toBeNull();
    expect(queryByLabelText("Italic")).toBeNull();
  });

  test("an empty model floats nothing even with a selection", async () => {
    const { editor, container } = mountFloating(deriveToolbar([], []));
    await selectRange(editor, EXPANDED);
    await act(async () => {});
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });
});
