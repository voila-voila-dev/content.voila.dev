// Default edit widgets — one input per field kind, for `CollectionForm`. Each
// receives the field's current value plus an `onChange` that emits a
// *correctly typed* value (number, boolean, Date, or string), so the value can
// be re-validated against the field's own Standard Schema without a coercion
// shim. The contract mirrors the dx escape hatch `{ value, onChange, error,
// field }`, plus an `id` so the form can wire a `<label htmlFor>`.

import type { Field, FieldMetaBase } from "@voila/content";
import { Input } from "@voila.dev/ui/input";
import { Select } from "@voila.dev/ui/select";
import { Switch } from "@voila.dev/ui/switch";
import { Textarea } from "@voila.dev/ui/textarea";
import type { ReactNode } from "react";
import { useMessages } from "../lib/messages";
import type { FieldIssue } from "../lib/validate";

export interface EditWidgetProps {
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  readonly field: Field;
  /** DOM id for `<label htmlFor>` association. */
  readonly id: string;
  /**
   * Space-separated id(s) of the labeling element(s), for `aria-labelledby` on
   * widgets whose focusable control can't be named through `<label htmlFor>`
   * (the Switch — Base UI moves `id` onto its hidden checkbox, so `htmlFor`
   * never reaches the visible `role="switch"` element).
   */
  readonly labelId?: string;
  readonly error?: string;
  /**
   * Validation issues below this field, paths relative to it. Only container
   * widgets (blocks, arrays, objects) read these — they slice by segment to put
   * each message next to the nested control that failed.
   */
  readonly issues?: ReadonlyArray<FieldIssue>;
  readonly disabled?: boolean;
}

/** An input that edits a single field value. */
export type EditWidget = (props: EditWidgetProps) => ReactNode;

/**
 * Shared ARIA wiring for the native controls: `aria-invalid` + `aria-describedby`
 * when the field has an error, and `aria-required` whenever the field is required
 * — so assistive tech announces "required" on focus, not only after a failed
 * submit (the visible `*` is `aria-hidden`).
 */
function aria(field: Field, id: string, error?: string) {
  return {
    ...(error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {}),
    ...(field.meta.required === true ? { "aria-required": true as const } : {}),
  };
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
      data-slot="text-input"
      id={id}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...aria(field, id, error)}
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
      data-slot="textarea-input"
      id={id}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...aria(field, id, error)}
    />
  );
}

/**
 * Markdown/code editor stand-in until the rich-text registry item lands: a
 * monospace textarea tall enough to draft multi-paragraph content (the default
 * `Textarea` min-height is ~3 rows).
 */
export function MonospaceTextareaInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  return (
    <Textarea
      data-slot="monospace-textarea-input"
      id={id}
      className="min-h-40 font-mono"
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      {...aria(field, id, error)}
    />
  );
}

interface NumberMetaShape {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

/** Matches the `#rrggbb` form the native color control requires. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Color editor: a native `<input type="color">` swatch paired with a text input
 * for the hex value (so it stays typeable/paste-able and named values survive a
 * round-trip the picker can't represent). Both edit the same string; the text
 * input carries the field `id`/`aria` wiring so the `<label>`, required, and
 * error states behave like every other widget.
 */
export function ColorInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  const text = typeof value === "string" ? value : "";
  // The swatch only accepts `#rrggbb`; fall back to black when the field is
  // empty or holds a partial/named color so the picker still opens on a hue.
  const swatch = HEX_COLOR.test(text) ? text : "#000000";
  const m = useMessages().form;
  return (
    <div data-slot="color-input" className="flex items-center gap-2">
      <input
        type="color"
        aria-label={m.colorPicker}
        value={swatch}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Input
        id={id}
        value={text}
        placeholder="#000000"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        {...aria(field, id, error)}
      />
    </div>
  );
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
      data-slot="number-input"
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
      {...aria(field, id, error)}
    />
  );
}

export function BooleanInput({
  value,
  onChange,
  id,
  labelId,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  // The block wrapper drops the inline-flex switch onto its own line below the
  // (inline) label, so the form's vertical spacing applies between them.
  return (
    <div data-slot="boolean-input">
      <Switch
        id={id}
        aria-labelledby={labelId}
        aria-required={field.meta.required === true ? true : undefined}
        checked={value === true}
        disabled={disabled}
        onCheckedChange={(c) => onChange(c)}
      />
    </div>
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

/** Sentinel item value for "no choice" — a kit Select can't hold `""`. */
const NONE = "__none__";

/**
 * Enum/select editor on the kit `Select` (portal popup, typeahead, keyboard
 * navigation), matching the rest of the form's controls. An optional field
 * gets a leading "—" item so it can be cleared back to empty; the emitted
 * value is the option's ORIGINAL raw (a numeric enum stays a number).
 */
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
  const current = value === null || value === undefined ? NONE : String(value);
  const items: Record<string, string> = Object.fromEntries([
    ...(required ? [] : [[NONE, "—"]]),
    ...options.map((o) => [o.value, o.label]),
  ]);
  return (
    <Select.Root
      value={current}
      items={items}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === null || next === undefined || next === NONE) return onChange(undefined);
        const hit = options.find((o) => o.value === next);
        onChange(hit ? hit.raw : undefined);
      }}
    >
      <Select.Trigger
        id={id}
        data-slot="select-input"
        className="w-full"
        {...aria(field, id, error)}
      >
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {required ? null : (
          <Select.Item value={NONE} className="text-muted-foreground">
            —
          </Select.Item>
        )}
        {options.map((o) => (
          <Select.Item key={o.value} value={o.value}>
            {o.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

/**
 * Fallback for kinds with no editor yet (media, relation, richText, json, …,
 * plus an `array` whose item is a bare validator). Honest and non-destructive:
 * it shows the kind and disables input rather than silently dropping or
 * corrupting the value.
 */
export function UnsupportedInput({ id, field }: EditWidgetProps): ReactNode {
  // richText advertises its own fix: the registry item that vends a real editor.
  const m = useMessages().form;
  const message = field.meta.kind === "richText" ? m.richTextMissing : m.noEditor(field.meta.kind);
  // An inert note, not a borrowed `<Input readOnly>`: a text input exposes the
  // message to assistive tech as editable form content. A `<p>` reads it as the
  // static hint it is. Keeps `id` so the field `<label htmlFor>` still resolves.
  return (
    <p
      data-slot="unsupported-input"
      id={id}
      className="rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground"
    >
      {message}
    </p>
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
    // The stored/REST form is epoch ms; a JSON-echoed `Date` arrives as an
    // ISO string; the widget itself emits a `Date`. Coerce all three.
    const date =
      value instanceof Date
        ? value
        : typeof value === "number" || typeof value === "string"
          ? new Date(value)
          : null;
    if (date === null || Number.isNaN(date.getTime())) return "";
    // datetime-local wants local "YYYY-MM-DDTHH:mm" (no zone, no seconds).
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
      data-slot="date-input"
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
      {...aria(field, id, error)}
    />
  );
}
