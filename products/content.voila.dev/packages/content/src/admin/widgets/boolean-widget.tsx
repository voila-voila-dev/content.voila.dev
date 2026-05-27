import type { BooleanField } from "@voila/content-schema";
import { Switch } from "@voila/ui";
import type { WidgetProps } from "./types.ts";

/**
 * `boolean` widget: a `Switch`. An unset value reads as `false` so the control
 * is always in a defined state; toggling emits the new boolean.
 */
export function BooleanWidget({
  id,
  name,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: WidgetProps<boolean, BooleanField>) {
  return (
    <Switch
      id={id}
      name={name}
      checked={value ?? false}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onCheckedChange={(checked) => onChange(checked)}
    />
  );
}
