import { describe, expect, test } from "bun:test";
import { fields, rt } from "@voila/content";
import type { Value } from "platejs";
import { fromWire, ORIGINAL_NODE_KEY, toWire, UNSUPPORTED_TYPE } from "../../src/content/wire.ts";

// A wire document is the engine's validated JSON: long type names, an `id` on
// every element, the `bullet-list > list-item > inline` list shape.
const wireDoc = [
  {
    id: "p1",
    type: "paragraph",
    align: "center",
    children: [{ text: "Hello " }, { text: "world", bold: true, italic: true }],
  },
  { id: "h1", type: "heading-1", children: [{ text: "Title" }] },
  { id: "h2", type: "heading-2", children: [{ text: "Sub" }] },
  { id: "h3", type: "heading-3", children: [{ text: "Sub-sub" }] },
  { id: "bq", type: "blockquote", cite: "src", children: [{ text: "quote" }] },
  {
    id: "ul",
    type: "bullet-list",
    children: [
      { id: "li1", type: "list-item", children: [{ text: "first" }] },
      { id: "li2", type: "list-item", children: [{ text: "second" }] },
    ],
  },
  {
    id: "ol",
    type: "ordered-list",
    start: 3,
    children: [{ id: "li3", type: "list-item", children: [{ text: "n" }] }],
  },
  {
    id: "a",
    type: "link",
    url: "https://example.com",
    title: "Ex",
    target: "_blank",
    children: [{ text: "link" }],
  },
] as const;

function fail(): never {
  throw new Error("generateId should not be called when every element already has an id");
}

describe("wire adapter — roundtrip", () => {
  test("wire → Plate → wire is value-equal across every supported element & mark", () => {
    const plate = fromWire(wireDoc);
    expect(toWire(plate, { generateId: fail })).toEqual(wireDoc);
  });

  test("an inline mention round-trips with its source/value/label intact", () => {
    const doc = [
      {
        id: "p",
        type: "paragraph",
        children: [
          { text: "Hi " },
          {
            id: "m",
            type: "mention",
            source: "users",
            value: "ada",
            label: "Ada Lovelace",
            children: [{ text: "" }],
          },
          { text: "!" },
        ],
      },
    ] as const;
    // The mention is a known kind (not wrapped as unsupported) and survives
    // byte-identical, and the engine's default validator accepts it.
    const out = toWire(fromWire(doc), { generateId: fail });
    expect(out).toEqual(doc);
    const field = fields.richText() as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    };
    expect(field["~standard"].validate(out).issues).toBeUndefined();
  });

  test("a block image round-trips with its url/alt/dimensions intact", () => {
    const doc = [
      {
        id: "p",
        type: "paragraph",
        children: [{ text: "before" }],
      },
      {
        id: "img",
        type: "image",
        url: "https://cdn.example.com/photo.png",
        alt: "A photo",
        width: 800,
        height: 600,
        children: [{ text: "" }],
      },
    ] as const;
    // The image is a known kind (not wrapped as unsupported), survives
    // byte-identical, and the engine's default validator accepts it.
    const out = toWire(fromWire(doc), { generateId: fail });
    expect(out).toEqual(doc);
    const field = fields.richText() as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    };
    expect(field["~standard"].validate(out).issues).toBeUndefined();
  });

  test("fromWire renames types and wraps list-item content in `lic`", () => {
    const plate = fromWire([
      {
        id: "ul",
        type: "bullet-list",
        children: [{ id: "li", type: "list-item", children: [{ text: "x" }] }],
      },
    ]) as Value;
    expect(plate).toEqual([
      {
        id: "ul",
        type: "ul",
        children: [
          { id: "li", type: "li", children: [{ type: "lic", children: [{ text: "x" }] }] },
        ],
      },
    ]);
  });

  test("list-item with inline content followed by a nested list round-trips in place", () => {
    const doc = [
      {
        id: "ul",
        type: "bullet-list",
        children: [
          {
            id: "li",
            type: "list-item",
            children: [
              { text: "lead" },
              {
                id: "sub",
                type: "ordered-list",
                children: [{ id: "li2", type: "list-item", children: [{ text: "nested" }] }],
              },
            ],
          },
        ],
      },
    ];
    expect(toWire(fromWire(doc), { generateId: fail })).toEqual(doc);
  });

  test("unsupported marks ride along verbatim on leaves", () => {
    const doc = [
      { id: "p", type: "paragraph", children: [{ text: "x", highlight: true, color: "#f00" }] },
    ];
    expect(toWire(fromWire(doc), { generateId: fail })).toEqual(doc);
  });
});

describe("wire adapter — unknown-node preservation", () => {
  const table = {
    id: "t",
    type: "table",
    children: [
      {
        id: "r",
        type: "table-row",
        children: [
          {
            id: "c",
            type: "table-cell",
            children: [{ id: "m", type: "mention", value: "u1", children: [{ text: "" }] }],
          },
        ],
      },
    ],
  };

  test("a top-level unsupported element is wrapped in an opaque void block", () => {
    const plate = fromWire([table]) as Value;
    expect(plate).toEqual([
      { id: "t", type: UNSUPPORTED_TYPE, [ORIGINAL_NODE_KEY]: table, children: [{ text: "" }] },
    ]);
  });

  test("a deeply-nested unknown (table > row > cell > mention) round-trips byte-identical", () => {
    expect(toWire(fromWire([table]), { generateId: fail })).toEqual([table]);
  });

  test("an unknown nested inside a supported element is preserved", () => {
    const doc = [
      {
        id: "bq",
        type: "blockquote",
        children: [{ id: "co", type: "callout", variant: "info", children: [{ text: "note" }] }],
      },
    ];
    expect(toWire(fromWire(doc), { generateId: fail })).toEqual(doc);
  });
});

describe("wire adapter — id backfill", () => {
  test("toWire mints ids for editor-created elements that lack one", () => {
    const plate: Value = [
      { type: "p", children: [{ text: "fresh" }] },
      { id: "kept", type: "h1", children: [{ text: "kept" }] },
    ];
    let n = 0;
    const out = toWire(plate, { generateId: () => `gen-${++n}` });
    expect(out).toEqual([
      { id: "gen-1", type: "paragraph", children: [{ text: "fresh" }] },
      { id: "kept", type: "heading-1", children: [{ text: "kept" }] },
    ]);
  });

  test("the default id generator produces unique ids", () => {
    const out = toWire([
      { type: "p", children: [{ text: "a" }] },
      { type: "p", children: [{ text: "b" }] },
    ]);
    const [a, b] = out as ReadonlyArray<{ id: string }>;
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });
});

describe("wire adapter — schema loop", () => {
  test("adapter output validates against richText()'s own validator (default field)", () => {
    const field = fields.richText() as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    };
    const out = toWire(fromWire(wireDoc), { generateId: fail });
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
