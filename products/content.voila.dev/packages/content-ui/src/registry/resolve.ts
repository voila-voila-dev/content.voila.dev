// The widget-resolution fallback chain shared by the display and edit
// registries: the field's explicit `meta.widget` name, then its `meta.kind`,
// then the registry's own fallback — so a widget is always returned and call
// sites never handle nulls.

import type { FieldMetaBase } from "@voila/content";

export function resolveWidget<W>(
  meta: FieldMetaBase,
  registry: Readonly<Record<string, W>>,
  fallback: W,
): W {
  return (meta.widget && registry[meta.widget]) || registry[meta.kind] || fallback;
}
