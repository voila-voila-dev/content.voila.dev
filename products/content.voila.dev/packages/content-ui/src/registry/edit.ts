// Edit-widget registry — the write-side twin of the display registry. Maps a
// field's `meta.widget ?? meta.kind` to an input widget; kinds with no editor
// fall through to `UnsupportedInput`. `mergeEditRegistry` layers caller
// overrides over the defaults — the custom-widget escape hatch for forms.

import type { FieldMetaBase } from "@voila/content";
import {
  BooleanInput,
  DateInput,
  type EditWidget,
  NumberInput,
  SelectInput,
  TextareaInput,
  TextInput,
  UnsupportedInput,
} from "../widgets/edit";
import { mergeMaps } from "./merge";

export type EditRegistry = Readonly<Record<string, EditWidget>>;

/** Built-in edit widgets keyed by field `kind`. */
export const defaultEditRegistry: EditRegistry = {
  string: TextInput,
  slug: TextInput,
  id: TextInput,
  color: TextInput,
  code: TextareaInput,
  markdown: TextareaInput,
  number: NumberInput,
  position: NumberInput,
  boolean: BooleanInput,
  date: DateInput,
  datetime: DateInput,
  time: DateInput,
  select: SelectInput,
  enum: SelectInput,
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
  return (meta.widget && registry[meta.widget]) || registry[meta.kind] || UnsupportedInput;
}
