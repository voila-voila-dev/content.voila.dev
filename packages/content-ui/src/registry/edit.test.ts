import { describe, expect, test } from "bun:test";
import type { FieldMetaBase } from "@voila/content";
import { SelectInput, TextInput, UnsupportedInput } from "../widgets/edit";
import { defaultEditRegistry, mergeEditRegistry, resolveEditWidget } from "./edit";

function meta(partial: Partial<FieldMetaBase> & { kind: string }): FieldMetaBase {
  return partial;
}

describe("resolveEditWidget", () => {
  test("resolves a select/enum field to the select input via its widget name", () => {
    expect(resolveEditWidget(meta({ kind: "enum", widget: "select" }), defaultEditRegistry)).toBe(
      SelectInput,
    );
  });

  test("resolves by kind when no widget name is set", () => {
    expect(resolveEditWidget(meta({ kind: "string" }), defaultEditRegistry)).toBe(TextInput);
  });

  test("falls back to UnsupportedInput for kinds with no editor", () => {
    expect(resolveEditWidget(meta({ kind: "media" }), defaultEditRegistry)).toBe(UnsupportedInput);
  });
});

describe("mergeEditRegistry", () => {
  test("returns the base untouched when no overrides are given", () => {
    expect(mergeEditRegistry()).toBe(defaultEditRegistry);
  });

  test("overrides win over the base without mutating it", () => {
    const custom = () => null;
    const merged = mergeEditRegistry({ string: custom });
    expect(merged.string).toBe(custom);
    expect(defaultEditRegistry.string).toBe(TextInput);
  });
});
