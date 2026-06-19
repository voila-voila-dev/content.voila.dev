import { describe, expect, test } from "bun:test";
import { fields, rt } from "@voila/content";
import { fromWire, toWire } from "@voila/rich-text-editor/content";

// The cross-package "schema loop": the `@voila/rich-text-editor` adapter and the
// `@voila/content` engine's `richText()` validator are designed to compose, so
// whatever the editor emits must decode against the field's schema or a write
// 422s. These assertions used to live in the editor package; since the editor is
// now standalone (no dependency on the engine), the contract is checked here,
// where both packages are present. `fail` proves no fresh id is minted on a
// document that already carries one (a pure round-trip).
function fail(): never {
  throw new Error("generateId must not be called for an already-id-complete document");
}

const wireDoc = [
  { id: "p1", type: "paragraph", children: [{ text: "hello ", bold: true }, { text: "world" }] },
  {
    id: "ul",
    type: "bullet-list",
    children: [
      {
        id: "li",
        type: "list-item",
        children: [
          { text: "see " },
          { id: "a", type: "link", url: "/x", children: [{ text: "x" }] },
        ],
      },
    ],
  },
];

describe("rich-text adapter ↔ richText() schema loop", () => {
  test("adapter output validates against richText()'s own validator (default field)", () => {
    const field = fields.richText() as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    };
    const out = toWire(fromWire(wireDoc), { generateId: fail });
    expect(out).toEqual(wireDoc);
    expect(field["~standard"].validate(out).issues).toBeUndefined();
  });

  test("a restored unknown node still validates when the field allows that kind", () => {
    const field = fields.richText() as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    };
    const doc = [{ id: "t", type: "horizontal-rule", children: [{ text: "" }] }];
    const out = toWire(fromWire(doc), { generateId: fail });
    expect(field["~standard"].validate(out).issues).toBeUndefined();
  });

  test("output of a restricted field validates against that restricted field", () => {
    const field = fields.richText({
      elements: [rt.paragraph, rt.link],
      marks: [rt.bold],
    }) as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    };
    const doc = [
      {
        id: "p",
        type: "paragraph",
        children: [
          { text: "see ", bold: true },
          { id: "a", type: "link", url: "/x", children: [{ text: "x" }] },
        ],
      },
    ];
    const out = toWire(fromWire(doc), { generateId: fail });
    expect(field["~standard"].validate(out).issues).toBeUndefined();
  });
});
