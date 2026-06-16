import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content";
import { createPlateEditor } from "platejs/react";
import { derivePlugins } from "../../src/content/capabilities.ts";
import { toWire } from "../../src/content/wire.ts";

// Autoformat: markdown shortcuts (`# `, `> `, `- `, `**bold**`, …) turn typed
// text into the matching node as you write. The rules are capability-gated — a
// field only offers a shortcut whose result it can persist — so each case here
// also asserts the emission still validates against the field's own schema.

const field = fields.richText() as unknown as {
  meta: { elements: ReadonlyArray<string>; marks: ReadonlyArray<string> };
  "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
};

function fullEditor(autoformat = true) {
  const { plugins, components } = derivePlugins(field.meta.elements, field.meta.marks, {
    autoformat,
  });
  return createPlateEditor({
    plugins,
    components,
    value: [{ type: "p", children: [{ text: "" }] }],
  });
}

/** Types `text` one character at a time from the start of the first block. */
function type(editor: ReturnType<typeof fullEditor>, text: string) {
  editor.tf.select({ path: [0, 0], offset: 0 });
  for (const ch of text) editor.tf.insertText(ch);
}

function expectValid(value: unknown) {
  expect(field["~standard"].validate(value).issues).toBeUndefined();
}

describe("autoformat — block shortcuts", () => {
  test.each([
    ["# ", "heading-1"],
    ["## ", "heading-2"],
    ["### ", "heading-3"],
    ["> ", "blockquote"],
  ])("%p turns the block into %p", (shortcut, wireType) => {
    const editor = fullEditor();
    type(editor, shortcut);
    const out = toWire(editor.children) as Array<{ type: string }>;
    expect(out[0]?.type).toBe(wireType);
    expectValid(out);
  });

  test("`- ` starts a bulleted list (ul > list-item)", () => {
    const editor = fullEditor();
    type(editor, "- ");
    const out = toWire(editor.children) as Array<{
      type: string;
      children: Array<{ type: string }>;
    }>;
    expect(out[0]?.type).toBe("bullet-list");
    expect(out[0]?.children[0]?.type).toBe("list-item");
    expectValid(out);
  });

  test("`1. ` starts an ordered list", () => {
    const editor = fullEditor();
    type(editor, "1. ");
    const out = toWire(editor.children) as Array<{ type: string }>;
    expect(out[0]?.type).toBe("ordered-list");
    expectValid(out);
  });
});

describe("autoformat — mark shortcuts", () => {
  test("`**bold**` marks the wrapped text bold", () => {
    const editor = fullEditor();
    type(editor, "**hi**");
    const out = toWire(editor.children) as Array<{
      children: Array<{ text: string; bold?: boolean }>;
    }>;
    const leaf = out[0]?.children.find((c) => c.text === "hi");
    expect(leaf?.bold).toBe(true);
    expectValid(out);
  });

  test("`` `code` `` marks the wrapped text as inline code", () => {
    const editor = fullEditor();
    type(editor, "`x`");
    const out = toWire(editor.children) as Array<{
      children: Array<{ text: string; code?: boolean }>;
    }>;
    const leaf = out[0]?.children.find((c) => c.text === "x");
    expect(leaf?.code).toBe(true);
    expectValid(out);
  });
});

describe("autoformat — gating", () => {
  test("opting out leaves typed markdown as literal text", () => {
    const editor = fullEditor(false);
    type(editor, "# ");
    const out = toWire(editor.children) as Array<{
      type: string;
      children: Array<{ text: string }>;
    }>;
    expect(out[0]?.type).toBe("paragraph");
    expect(out[0]?.children[0]?.text).toBe("# ");
  });

  test("a restricted field offers no shortcut for a kind it can't persist", () => {
    // Only paragraph + bold allowed: `# ` has no enabled heading plugin, so the
    // shortcut can't fire and the text stays literal.
    const { plugins, components } = derivePlugins(["paragraph"], ["bold"]);
    const editor = createPlateEditor({
      plugins,
      components,
      value: [{ type: "p", children: [{ text: "" }] }],
    });
    editor.tf.select({ path: [0, 0], offset: 0 });
    for (const ch of "# ") editor.tf.insertText(ch);
    const out = toWire(editor.children) as Array<{
      type: string;
      children: Array<{ text: string }>;
    }>;
    expect(out[0]?.type).toBe("paragraph");
    expect(out[0]?.children[0]?.text).toBe("# ");
    // …but the bold shortcut it *does* allow still works.
    for (const ch of "**b**") editor.tf.insertText(ch);
    const out2 = toWire(editor.children) as Array<{
      children: Array<{ text: string; bold?: boolean }>;
    }>;
    expect(out2[0]?.children.some((c) => c.text === "b" && c.bold)).toBe(true);
  });
});
