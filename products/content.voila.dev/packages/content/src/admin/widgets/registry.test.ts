import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content-schema";
import { DateWidget } from "./date-widget.tsx";
import {
  builtinWidgets,
  createWidgetRegistry,
  defaultWidgetRegistry,
  defineWidget,
  resolveWidget,
} from "./registry.ts";
import { StringWidget } from "./string-widget.tsx";

describe("default widget registry", () => {
  test("registers a widget for every built-in field kind", () => {
    const kinds = [...defaultWidgetRegistry.keys()].sort();
    expect(kinds).toEqual(["boolean", "date", "datetime", "number", "select", "slug", "string"]);
  });

  test("date and datetime share the DateWidget", () => {
    expect(resolveWidget(fields.date())).toBe(DateWidget);
    expect(resolveWidget(fields.datetime())).toBe(DateWidget);
  });
});

describe("resolveWidget", () => {
  test("returns the registered widget for a kind", () => {
    expect(resolveWidget(fields.string())).toBe(StringWidget);
  });

  test("falls back to the string widget for an unknown kind", () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately unknown kind.
    expect(resolveWidget({ kind: "exotic" } as any)).toBe(StringWidget);
  });
});

describe("defineWidget + createWidgetRegistry", () => {
  test("extra widgets override built-ins for the same kind", () => {
    const Custom = () => null;
    const registry = createWidgetRegistry([defineWidget("string", Custom)]);
    expect(registry.get("string")).toBe(Custom);
    // Built-ins still present.
    expect(registry.get("number")).toBeDefined();
  });

  test("a fresh registry is independent of the shared default", () => {
    const registry = createWidgetRegistry();
    expect(registry).not.toBe(defaultWidgetRegistry);
    // One entry per built-in; date and datetime are distinct kinds that happen
    // to share a component, so both keys are present.
    expect(registry.size).toBe(builtinWidgets.length);
  });
});
