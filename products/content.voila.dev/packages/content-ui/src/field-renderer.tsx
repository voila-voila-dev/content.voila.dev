// FieldRenderer — given a `Field` and its value, resolve the right display
// widget from the registry and render it. The single composition point both
// `DataTable` cells and (later) `DetailView` rows go through, so cell styling
// and the custom-widget escape hatch live in exactly one place.

import type { Field } from "@voila/content";
import type { ReactNode } from "react";
import {
  type DisplayRegistry,
  defaultDisplayRegistry,
  resolveDisplayWidget,
} from "./registry/registry";

export interface FieldRendererProps {
  readonly field: Field;
  readonly value: unknown;
  /** Override widgets per kind/name; merged over the defaults by the caller. */
  readonly registry?: DisplayRegistry;
}

export function FieldRenderer({
  field,
  value,
  registry = defaultDisplayRegistry,
}: FieldRendererProps): ReactNode {
  const Widget = resolveDisplayWidget(field.meta, registry);
  return <Widget value={value} meta={field.meta} />;
}
