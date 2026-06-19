// Display-widget registry. A `DisplayRegistry` maps a widget key to a
// `DisplayWidget`; `resolveDisplayWidget` picks one for a field by trying its
// explicit `meta.widget`, then its `meta.kind`, then a JSON fallback. Consumers
// override per-kind by passing a partial registry that is merged over the
// defaults (`mergeDisplayRegistry`) — the escape hatch for custom cell renderers.

import type { FieldMetaBase } from "@voila/content";
import {
  BooleanDisplay,
  DateDisplay,
  type DisplayWidget,
  JsonDisplay,
  MultilineTextDisplay,
  NumberDisplay,
  RichTextValueDisplay,
  TextDisplay,
} from "../widgets/display";
import { MediaDisplay } from "../widgets/media";
import { mergeMaps } from "./merge";
import { resolveWidget } from "./resolve";

export type DisplayRegistry = Readonly<Record<string, DisplayWidget>>;

/**
 * Built-in display widgets keyed by field `kind`. Kinds with no dedicated entry
 * (array, object, relation, json, …) fall through to `JsonDisplay`.
 */
export const defaultDisplayRegistry: DisplayRegistry = {
  string: TextDisplay,
  slug: TextDisplay,
  id: TextDisplay,
  color: TextDisplay,
  code: MultilineTextDisplay,
  markdown: MultilineTextDisplay,
  richText: RichTextValueDisplay,
  enum: TextDisplay,
  select: TextDisplay,
  duration: TextDisplay,
  position: NumberDisplay,
  number: NumberDisplay,
  boolean: BooleanDisplay,
  date: DateDisplay,
  datetime: DateDisplay,
  time: DateDisplay,
  media: MediaDisplay,
};

/** Merge a caller's overrides over the default display widgets. */
export function mergeDisplayRegistry(overrides?: DisplayRegistry): DisplayRegistry {
  return mergeMaps(defaultDisplayRegistry, overrides);
}

/**
 * Resolve the display widget for a field: prefer the explicit `meta.widget`
 * name, then the `meta.kind`, then the shared JSON fallback so a renderer is
 * always returned (no nulls to handle at the call site).
 */
export function resolveDisplayWidget(
  meta: FieldMetaBase,
  registry: DisplayRegistry,
): DisplayWidget {
  return resolveWidget(meta, registry, JsonDisplay);
}
