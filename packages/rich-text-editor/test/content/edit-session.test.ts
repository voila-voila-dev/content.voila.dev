import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content";
import { createPlateEditor } from "platejs/react";
import { derivePlugins } from "../../src/content/capabilities.ts";
import { fromWire, toWire } from "../../src/content/wire.ts";

// The Phase 1 exit criterion: compose `richText()`'s validator with the
// adapter through a *real* Plate editor — every valid document must survive an
// edit session (normalization + edits) and every emission must validate.

const field = fields.richText() as unknown as {
  meta: { elements: ReadonlyArray<string>; marks: ReadonlyArray<string> };
  "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
};

function editorFor(value: ReadonlyArray<unknown>) {
  const { plugins, components } = derivePlugins(field.meta.elements, field.meta.marks);
  return createPlateEditor({ plugins, components, value: fromWire(value as never) as never });
}

function expectValid(value: unknown) {
  expect(field["~standard"].validate(value).issues).toBeUndefined();
}

describe("edit session — real Plate editor", () => {
  test("a document with an unsupported node survives create + normalize untouched", () => {
    const doc = [
      { id: "p", type: "paragraph", children: [{ text: "intro", bold: true }] },
      {
        id: "t",
        type: "table",
        children: [
          {
            id: "r",
            type: "table-row",
            children: [{ id: "c", type: "table-cell", children: [{ text: "cell" }] }],
          },
        ],
      },
      {
        id: "ul",
        type: "bullet-list",
        children: [{ id: "li", type: "list-item", children: [{ text: "item" }] }],
      },
    ];
    const editor = editorFor(doc);
    editor.tf.normalize({ force: true });
    const out = toWire(editor.children);
    expect(out).toEqual(doc);
    expectValid(out);
  });

  test("an edit that inserts a fresh node still emits a valid, id-complete document", () => {
    const editor = editorFor([{ id: "p", type: "paragraph", children: [{ text: "hi" }] }]);
    // A node inserted mid-session arrives without an id; the editor (node-id
    // plugin) and toWire's backfill both guarantee one.
    editor.tf.insertNodes({ type: "p", children: [{ text: "added" }] }, { at: [1] });
    const out = toWire(editor.children) as ReadonlyArray<{ id: string }>;
    expect(out).toHaveLength(2);
    expect(out[1]?.id).toBeTruthy();
    expectValid(out);
  });
});
