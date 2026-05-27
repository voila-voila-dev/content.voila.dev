import type { AnyFieldDef } from "@voila/content-schema";
import { BooleanWidget } from "./boolean-widget.tsx";
import { DateWidget } from "./date-widget.tsx";
import { NumberWidget } from "./number-widget.tsx";
import { SelectWidget } from "./select-widget.tsx";
import { SlugWidget } from "./slug-widget.tsx";
import { StringWidget } from "./string-widget.tsx";
import type { WidgetComponent, WidgetDef } from "./types.ts";

/**
 * Register a widget for a field `kind`. Mirrors `defineField`: a third-party
 * field package ships a `defineField(...)` constructor *and* a matching
 * `defineWidget(...)` so the admin knows how to edit that kind. The single cast
 * here is the one variance escape — widget components are written against their
 * own narrow value type but stored as the wide `WidgetComponent`.
 *
 * The runtime ships in M2; the public type is frozen in M5 (see roadmap §M5).
 */
export function defineWidget<TValue = unknown, TField extends AnyFieldDef = AnyFieldDef>(
  kind: string,
  component: WidgetComponent<TValue, TField>,
): WidgetDef {
  return { kind, component: component as WidgetComponent };
}

export type WidgetRegistry = Map<string, WidgetComponent>;

/** The built-in widgets, one per primitive field kind. */
export const builtinWidgets: readonly WidgetDef[] = [
  defineWidget("string", StringWidget),
  defineWidget("number", NumberWidget),
  defineWidget("boolean", BooleanWidget),
  defineWidget("date", DateWidget),
  defineWidget("datetime", DateWidget),
  defineWidget("select", SelectWidget),
  defineWidget("slug", SlugWidget),
];

/** Build a registry from the built-ins plus any `extra` (later wins on conflict). */
export function createWidgetRegistry(extra: readonly WidgetDef[] = []): WidgetRegistry {
  const registry: WidgetRegistry = new Map();
  for (const w of [...builtinWidgets, ...extra]) registry.set(w.kind, w.component);
  return registry;
}

/** Shared default registry — built-ins only. */
export const defaultWidgetRegistry: WidgetRegistry = createWidgetRegistry();

/**
 * Resolve the widget for a field. Falls back to the string widget for an
 * unknown/custom kind so the field still renders an editable control rather
 * than throwing — mirroring the read path's string coercion in `field-display`.
 */
export function resolveWidget(
  field: AnyFieldDef,
  registry: WidgetRegistry = defaultWidgetRegistry,
): WidgetComponent {
  // The fallback is the same variance bridge as `defineWidget`: the string
  // widget is written against its narrow value type, widened to the registry's.
  return registry.get(field.kind) ?? (StringWidget as WidgetComponent);
}
