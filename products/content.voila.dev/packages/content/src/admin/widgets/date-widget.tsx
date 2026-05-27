import type { DateField, DateTimeField } from "@voila/content-schema";
import { cn, Input } from "@voila/ui";
import type { WidgetProps } from "./types.ts";

/** ISO datetime → the local value a `datetime-local` input expects (`YYYY-MM-DDTHH:mm`). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Shared widget for `date` and `datetime`. A `date` stores `YYYY-MM-DD`, which
 * a native `date` input round-trips verbatim. A `datetime` stores an ISO 8601
 * string *with offset* (the validator requires it), so we convert to/from the
 * browser's local `datetime-local` value and normalize back to UTC ISO on edit.
 */
export function DateWidget({
  id,
  name,
  field,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
}: WidgetProps<string, DateField | DateTimeField>) {
  const isDateTime = field.kind === "datetime";
  const inputValue = !value ? "" : isDateTime ? toLocalInput(value) : value;

  return (
    <Input
      id={id}
      name={name}
      type={isDateTime ? "datetime-local" : "date"}
      value={inputValue}
      disabled={disabled}
      onBlur={onBlur}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("w-fit", invalid && "border-destructive")}
      onChange={(e) => {
        const raw = e.currentTarget.value;
        if (raw === "") return onChange(undefined);
        if (!isDateTime) return onChange(raw);
        const d = new Date(raw);
        onChange(Number.isNaN(d.getTime()) ? undefined : d.toISOString());
      }}
    />
  );
}
