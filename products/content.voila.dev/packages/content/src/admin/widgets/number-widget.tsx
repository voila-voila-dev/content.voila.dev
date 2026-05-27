import type { NumberField } from "@voila/content-schema";
import { cn, Input } from "@voila/ui";
import type { WidgetProps } from "./types.ts";

/**
 * `number` widget: a native numeric input wired to the field's `min` / `max` /
 * `step`. An empty input emits `undefined` (cleared) rather than `NaN`, so an
 * optional number field round-trips cleanly.
 */
export function NumberWidget({
  id,
  name,
  field,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
}: WidgetProps<number, NumberField>) {
  return (
    <Input
      id={id}
      name={name}
      type="number"
      inputMode={field.integer ? "numeric" : "decimal"}
      value={value ?? ""}
      min={field.min}
      max={field.max}
      step={field.step ?? (field.integer ? 1 : undefined)}
      disabled={disabled}
      onBlur={onBlur}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn(invalid && "border-destructive")}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        onChange(raw === "" ? undefined : Number(raw));
      }}
    />
  );
}
