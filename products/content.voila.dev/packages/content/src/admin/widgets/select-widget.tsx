import { type SelectField, selectOption } from "@voila/content-schema";
import { cn } from "@voila/ui";
import type { WidgetProps } from "./types.ts";

/**
 * `select` widget: a native `<select>` styled to match the design system's
 * input. A native control is fully keyboard- and screen-reader-accessible and
 * has no portal/positioner layout (which doesn't exist under the test DOM); the
 * fancier Base UI `Select` can be dropped in later without touching the
 * `WidgetProps` contract.
 */
export function SelectWidget({
  id,
  name,
  field,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
}: WidgetProps<string, SelectField>) {
  const options = field.options.map(selectOption);
  return (
    <select
      id={id}
      name={name}
      value={value ?? ""}
      disabled={disabled}
      onBlur={onBlur}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.currentTarget.value === "" ? undefined : e.currentTarget.value)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-destructive",
      )}
    >
      <option value="">{field.required ? "Select…" : "—"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
