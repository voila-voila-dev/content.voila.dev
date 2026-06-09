// Default edit widgets — one input per field kind, for `CollectionForm`. Each
// receives the field's current value plus an `onChange` that emits a
// *correctly typed* value (number, boolean, Date, or string), so the value can
// be re-validated against the field's own Standard Schema without a coercion
// shim. The contract mirrors the dx escape hatch `{ value, onChange, error,
// field }`, plus an `id` so the form can wire a `<label htmlFor>`.

import type { Field, FieldMetaBase } from "@voila/content";
import { cn, Input, Switch, Textarea } from "@voila/ui";
import type { ReactNode } from "react";

export interface EditWidgetProps {
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly field: Field;
  /** DOM id for `<label htmlFor>` association. */
  readonly id: string;
  readonly error?: string;
  readonly disabled?: boolean;
}

/** An input that edits a single field value. */
export type EditWidget = (props: EditWidgetProps) => ReactNode;

/** `aria-invalid` + `aria-describedby` wiring shared by the native controls. */
function aria(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : undefined;
}

export function TextInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  return (
    <Input
      id={id}
      value={typeof value === "string" ? value : ""}
      placeholder={field.meta.description}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...aria(id, error)}
    />
  );
}

export function TextareaInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  return (
    <Textarea
      id={id}
      value={typeof value === "string" ? value : ""}
      placeholder={field.meta.description}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...aria(id, error)}
    />
  );
}

interface NumberMetaShape {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

export function NumberInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  const m = field.meta as FieldMetaBase & NumberMetaShape;
  return (
    <Input
      id={id}
      type="number"
      value={typeof value === "number" ? String(value) : ""}
      min={m.min}
      max={m.max}
      step={m.integer ? 1 : undefined}
      disabled={disabled}
      // An empty input clears the value (→ required check); otherwise emit a
      // number so the field's numeric schema validates it directly.
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange(undefined);
        const n = Number(raw);
        onChange(Number.isNaN(n) ? undefined : n);
      }}
      {...aria(id, error)}
    />
  );
}

export function BooleanInput({ value, onChange, id, disabled }: EditWidgetProps): ReactNode {
  return (
    <Switch
      id={id}
      checked={value === true}
      disabled={disabled}
      onCheckedChange={(c) => onChange(c)}
    />
  );
}

interface Option {
  readonly value: string;
  readonly label: string;
  /** The original (possibly numeric) field value this option carries. */
  readonly raw: string | number;
}

/** Build the option list for a select/enum field from its metadata. */
export function selectOptions(meta: FieldMetaBase): Option[] {
  if (meta.kind === "enum") {
    const values = (meta as { values?: Record<string, string | number> }).values;
    if (!values) return [];
    return Object.entries(values).map(
      ([label, raw]): Option => ({ value: String(raw), label, raw }),
    );
  }
  const options = (meta as { options?: ReadonlyArray<string> }).options ?? [];
  return options.map((o): Option => ({ value: o, label: o, raw: o }));
}

export function SelectInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  const options = selectOptions(field.meta);
  const required = field.meta.required === true;
  const current = value === null || value === undefined ? "" : String(value);
  return (
    <select
      id={id}
      value={current}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      )}
      onChange={(e) => {
        const next = options.find((o) => o.value === e.target.value);
        onChange(next ? next.raw : undefined);
      }}
      {...aria(id, error)}
    >
      {/* A placeholder row so an optional select can be cleared back to empty. */}
      {required ? null : <option value="">—</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Fallback for kinds with no editor yet (array, object, media, relation,
 * richText, …). Honest and non-destructive: it shows the kind and disables
 * input rather than silently dropping or corrupting the value.
 */
export function UnsupportedInput({ id, field, disabled }: EditWidgetProps): ReactNode {
  return (
    <Input
      id={id}
      value={`No editor for "${field.meta.kind}" yet`}
      disabled={disabled ?? true}
      readOnly
    />
  );
}

const DATE_INPUT_TYPE: Record<string, string> = {
  date: "date",
  datetime: "datetime-local",
  time: "time",
};

/** Format the stored value into what the native control expects to display. */
function dateInputValue(kind: string, value: unknown): string {
  if (kind === "datetime") {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
    // datetime-local wants local "YYYY-MM-DDTHH:mm" (no zone, no seconds).
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  // `date` and `time` store ISO strings already in the control's format.
  return typeof value === "string" ? value : "";
}

export function DateInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  const kind = field.meta.kind;
  return (
    <Input
      id={id}
      type={DATE_INPUT_TYPE[kind] ?? "date"}
      // `time` fields store HH:MM:SS, so ask the control for seconds precision.
      step={kind === "time" ? 1 : undefined}
      value={dateInputValue(kind, value)}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange(undefined);
        // datetime decodes to a `Date`; date/time stay ISO strings.
        onChange(kind === "datetime" ? new Date(v) : v);
      }}
      {...aria(id, error)}
    />
  );
}
