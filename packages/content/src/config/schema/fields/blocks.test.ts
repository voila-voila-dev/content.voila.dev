import { describe, expect, it } from "bun:test";
import { decodeSync, SchemaError, validateSync } from "../std";
import { array } from "./array";
import { blocks } from "./blocks";
import { markdown } from "./markdown";
import { media } from "./media";
import { object } from "./object";
import { richText } from "./rich-text";
import { string } from "./string";

const page = blocks({
  types: {
    hero: {
      label: "Hero banner",
      icon: "Sparkle",
      description: "Big title over an image",
      fields: { title: string({ required: true }), subtitle: string() },
    },
    faq: {
      fields: {
        items: array(object({ question: string({ required: true }), answer: markdown() })),
      },
    },
  },
});

describe("fields.blocks", () => {
  it("decodes a mixed list and keeps each block's type", () => {
    const value = decodeSync(page, [
      { type: "hero", title: "Hi", subtitle: "" },
      { type: "faq", items: [{ question: "Why?", answer: "Because." }] },
    ]);
    expect(value).toEqual([
      { type: "hero", title: "Hi" },
      { type: "faq", items: [{ question: "Why?", answer: "Because." }] },
    ]);
  });

  it("exposes the catalogue in meta with humanized default labels", () => {
    expect(page.meta.kind).toBe("blocks");
    expect(page.meta.widget).toBe("blocks");
    expect(page.meta.types.hero).toMatchObject({
      label: "Hero banner",
      icon: "Sparkle",
      description: "Big title over an image",
    });
    expect(page.meta.types.faq?.label).toBe("Faq");
    expect(Object.keys(page.meta.types.hero?.fields ?? {})).toEqual(["title", "subtitle"]);
  });

  it("rejects an unknown block type under the item's `type` path", () => {
    const r = validateSync(page, [{ type: "hero", title: "ok" }, { type: "nope" }]);
    expect(r.issues).toEqual([{ message: 'Unknown block type "nope"', path: [1, "type"] }]);
  });

  it("reports a missing required nested field under its index and key", () => {
    const r = validateSync(page, [{ type: "hero", title: "ok" }, { type: "hero" }]);
    expect(r.issues).toEqual([{ message: "Required.", path: [1, "title"] }]);
    expect(() => decodeSync(page, [{ type: "hero" }])).toThrow(SchemaError);
    expect(() => decodeSync(page, [{ type: "hero" }])).toThrow("0.title: Required.");
  });

  it("rejects non-object items", () => {
    expect(validateSync(page, ["hero"]).issues).toEqual([
      { message: "Expected a block", path: [0] },
    ]);
  });

  it("honours min / max", () => {
    const bounded = blocks({ types: { a: { fields: {} } }, min: 1, max: 2 });
    expect(validateSync(bounded, []).issues?.[0]?.message).toMatch(/at least 1/);
    expect(
      validateSync(bounded, [{ type: "a" }, { type: "a" }, { type: "a" }]).issues?.[0]?.message,
    ).toMatch(/at most 2/);
    expect(bounded.meta.min).toBe(1);
    expect(bounded.meta.max).toBe(2);
  });

  it("throws when no type is declared", () => {
    expect(() => blocks({ types: {} })).toThrow(/at least one block type/);
  });

  it("throws when a nested field is localized", () => {
    expect(() =>
      blocks({ types: { hero: { fields: { title: string({ localized: true }) } } } }),
    ).toThrow(/cannot be localized/);
  });

  it("can itself be localized and required", () => {
    const f = blocks({ types: { a: { fields: {} } }, localized: true, required: true });
    expect(f.meta.localized).toBe(true);
    expect(f.meta.required).toBe(true);
    expect(f.inner?.meta.kind).toBe("blocks");
  });

  it("accepts media and rich text inside a block", () => {
    const f = blocks({ types: { a: { fields: { image: media(), body: richText() } } } });
    expect(validateSync(f, [{ type: "a" }]).issues).toBeUndefined();
  });
});
