import type { StringField } from "@voila/content-schema";
import { cn, Input, Textarea } from "@voila/ui";
import type { WidgetProps } from "./types.ts";

/** Map a string `format` to the closest native input type for free UA affordances. */
function inputType(format: StringField["format"]): string {
  if (format === "email") return "email";
  if (format === "url") return "url";
  return "text";
}

/**
 * `string` widget: a single-line `Input`, or a `Textarea` when the field sets
 * `multiline`. The format hint (`email` / `url`) becomes the input `type` so
 * the browser keyboard + built-in affordances match; real validation still
 * runs through the field's Standard Schema validator.
 */
export function StringWidget({
  id,
  name,
  field,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
}: WidgetProps<string, StringField>) {
  const shared = {
    id,
    name,
    value: value ?? "",
    disabled,
    onBlur,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  };

  if (field.multiline) {
    return (
      <Textarea
        {...shared}
        rows={field.rows ?? 4}
        className={cn(invalid && "border-destructive")}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  }

  return (
    <Input
      {...shared}
      type={inputType(field.format)}
      className={cn(invalid && "border-destructive")}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
}
