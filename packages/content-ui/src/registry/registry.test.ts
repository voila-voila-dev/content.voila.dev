import { describe, expect, test } from "bun:test";
import type { FieldMetaBase } from "@voila/content";
import { JsonDisplay, RichTextValueDisplay, TextDisplay } from "../widgets/display";
import { defaultDisplayRegistry, mergeDisplayRegistry, resolveDisplayWidget } from "./registry";

function meta(partial: Partial<FieldMetaBase> & { kind: string }): FieldMetaBase {
  return partial;
}

describe("resolveDisplayWidget", () => {
  test("prefers an explicit widget name over the kind", () => {
    const custom = () => null;
    const registry = mergeDisplayRegistry({ stars: custom });
    expect(resolveDisplayWidget(meta({ kind: "number", widget: "stars" }), registry)).toBe(custom);
  });

  test("falls back to the kind when the widget name is unknown", () => {
    const w = resolveDisplayWidget(
      meta({ kind: "string", widget: "nope" }),
      defaultDisplayRegistry,
    );
    expect(w).toBe(TextDisplay);
  });

  test("resolves by kind when no widget name is set", () => {
    expect(resolveDisplayWidget(meta({ kind: "string" }), defaultDisplayRegistry)).toBe(
      TextDisplay,
    );
  });

  test("falls back to JsonDisplay for unknown kinds", () => {
    expect(resolveDisplayWidget(meta({ kind: "relation" }), defaultDisplayRegistry)).toBe(
      JsonDisplay,
    );
  });

  test("resolves richText to the plain-text flatten, not JsonDisplay", () => {
    expect(resolveDisplayWidget(meta({ kind: "richText" }), defaultDisplayRegistry)).toBe(
      RichTextValueDisplay,
    );
  });
});

describe("mergeDisplayRegistry", () => {
  test("returns the base untouched when no overrides are given", () => {
    expect(mergeDisplayRegistry()).toBe(defaultDisplayRegistry);
  });

  test("overrides win over the base without mutating it", () => {
    const custom = () => null;
    const merged = mergeDisplayRegistry({ string: custom });
    expect(merged.string).toBe(custom);
    expect(defaultDisplayRegistry.string).toBe(TextDisplay);
  });
});
