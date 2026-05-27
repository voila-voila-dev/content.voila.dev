import type { AnyFieldDef } from "@voila/content-schema";
import { cn, Label } from "@voila/ui";
import { humanizeFieldName } from "../humanize.ts";
import { resolveWidget, type WidgetRegistry } from "./registry.ts";
import type { WidgetProps } from "./types.ts";

/**
 * The host that turns a field def into a labelled, described, error-aware form
 * row: it resolves the right widget from the registry, renders the label
 * (humanized when no explicit `label`), wires `aria-describedby` to the
 * description + error, and surfaces a validation error beneath the control.
 *
 * It stays form-library-agnostic — value/onChange/error are passed in. The M2
 * form layer (TanStack Form) supplies them; tests drive it with `useState`.
 */
export interface FieldWidgetProps
  extends Pick<
    WidgetProps,
    "name" | "field" | "value" | "onChange" | "onBlur" | "disabled" | "doc"
  > {
  /** Validation error to surface beneath the control, if any. */
  error?: string;
  /** Override the default registry (e.g. with plugin widgets). */
  registry?: WidgetRegistry;
  /** Explicit control id; defaults to `field-<name>`. */
  id?: string;
}

export function FieldWidget({
  name,
  field,
  value,
  onChange,
  onBlur,
  disabled,
  doc,
  error,
  registry,
  id = `field-${name}`,
}: FieldWidgetProps) {
  const Widget = resolveWidget(field, registry);
  const label = field.label ?? humanizeFieldName(name);
  const invalid = Boolean(error);
  const required = field.required === true;
  const descId = field.description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [errId, descId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={cn(invalid && "text-destructive")}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Widget
        id={id}
        name={name}
        field={field as AnyFieldDef}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        invalid={invalid}
        describedBy={describedBy}
        doc={doc}
      />
      {field.description ? (
        <p id={descId} className="text-muted-foreground text-xs">
          {field.description}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
