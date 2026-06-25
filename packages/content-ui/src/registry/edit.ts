// Edit-widget registry — the write-side twin of the display registry. Maps a
// field's `meta.widget ?? meta.kind` to an input widget; kinds with no editor
// fall through to `UnsupportedInput`. `mergeEditRegistry` layers caller
// overrides over the defaults — the custom-widget escape hatch for forms.

import type { FieldMetaBase } from "@voila/content";
import {
  BooleanInput,
  ColorInput,
  DateInput,
  type EditWidget,
  MonospaceTextareaInput,
  NumberInput,
  SelectInput,
  TextInput,
  UnsupportedInput,
} from "../widgets/edit";
import { GeoInput } from "../widgets/geo";
import { mergeMaps } from "./merge";
import { resolveWidget } from "./resolve";

export type EditRegistry = Readonly<Record<string, EditWidget>>;

/** Built-in edit widgets keyed by field `kind`. */
export const defaultEditRegistry: EditRegistry = {
  string: TextInput,
  slug: TextInput,
  id: TextInput,
  color: ColorInput,
  code: MonospaceTextareaInput,
  markdown: MonospaceTextareaInput,
  number: NumberInput,
  position: NumberInput,
  boolean: BooleanInput,
  date: DateInput,
  datetime: DateInput,
  time: DateInput,
  select: SelectInput,
  enum: SelectInput,
  // The dependency-free lat/lng pair. The admin layer upgrades this to a map
  // picker (`createGeoInput`) using its configured `mapStyleUrl`.
  geo: GeoInput,
};

/** Merge a caller's overrides over the default edit widgets. */
export function mergeEditRegistry(overrides?: EditRegistry): EditRegistry {
  return mergeMaps(defaultEditRegistry, overrides);
}

/**
 * Resolve the edit widget for a field: prefer the explicit `meta.widget` name,
 * then the `meta.kind`, then the honest `UnsupportedInput` fallback.
 */
export function resolveEditWidget(meta: FieldMetaBase, registry: EditRegistry): EditWidget {
  return resolveWidget(meta, registry, UnsupportedInput);
}
