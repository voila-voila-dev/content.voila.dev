// Object widgets — the editor and reader for `fields.object({ ... })`. The
// editor is a bordered group of the members' own widgets (`NestedFields`),
// laid out inline (one row, labels kept) when the record is a handful of
// short scalars — `{ label, href }` — and stacked otherwise (`layoutFor`).
// Emits the whole record on every edit and `undefined` once every member is
// blank so an optional object goes back to "not provided". Without
// `meta.shape` (a hand-built field) it degrades to the unsupported-input notice.

import type { FieldsMap } from "@voila/content";
import { cn } from "@voila.dev/ui/utils";
import type { ReactNode } from "react";
import { isEmpty } from "../lib/blank";
import type { Doc } from "../lib/doc";
import { getFieldLabel } from "../lib/humanize";
import { layoutFor, NestedDisplayRows, NestedFields, visibleKeys } from "../nested-fields";
import { type DisplayWidgetProps, Empty, isCompact, Preview } from "./display";
import { type EditWidgetProps, UnsupportedInput } from "./edit";

interface ObjectMetaShape {
  readonly shape?: FieldsMap;
}

function asRecord(value: unknown): Readonly<Doc> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Doc>)
    : undefined;
}

export function ObjectInput(props: EditWidgetProps): ReactNode {
  const shape = (props.field.meta as ObjectMetaShape).shape;
  if (!shape) return <UnsupportedInput {...props} />;
  const layout = layoutFor(shape);
  return (
    <fieldset
      data-slot="object-input"
      data-layout={layout}
      id={props.id}
      aria-labelledby={props.labelId}
      aria-invalid={props.error ? true : undefined}
      disabled={props.disabled}
      className={cn(
        "min-w-0 rounded-md border",
        layout === "inline" ? "p-3" : "p-4",
        props.error && "border-destructive",
      )}
    >
      <NestedFields
        fields={shape}
        layout={layout}
        value={asRecord(props.value)}
        onChange={(next) => {
          const blank = Object.values(next).every(isEmpty);
          props.onChange(blank ? undefined : next);
        }}
        idPrefix={props.id}
        issues={props.issues}
        disabled={props.disabled}
      />
    </fieldset>
  );
}

/** Read mode: `Label: value · Label: value` on dense surfaces, rows in detail. */
export function ObjectDisplay({ value, meta, context }: DisplayWidgetProps): ReactNode {
  const shape = (meta as ObjectMetaShape).shape;
  const record = asRecord(value);
  if (!record || Object.keys(record).length === 0) return <Empty />;
  if (!shape) return <Preview slot="object-display" text={JSON.stringify(record)} />;
  if (isCompact(context)) {
    const parts = visibleKeys(shape)
      .filter((key) => !isEmpty(record[key]) && typeof record[key] !== "object")
      .slice(0, 2)
      .map(
        (key) => `${getFieldLabel(key, shape[key] as FieldsMap[string])}: ${String(record[key])}`,
      );
    const text = parts.length > 0 ? parts.join(" · ") : `${Object.keys(record).length} fields`;
    return <Preview slot="object-display" text={text} />;
  }
  return <NestedDisplayRows fields={shape} value={record} />;
}
