import type { SlugField } from "@voila/content-schema";
import { cn, Input } from "@voila/ui";
import { useEffect, useRef } from "react";
import { slugify } from "./slugify.ts";
import type { WidgetProps } from "./types.ts";

/**
 * `slug` widget: a monospace text input that auto-derives from a sibling field
 * (`field.from`, e.g. `"title"`) until the user types into it, after which it
 * stops tracking. A pre-filled value (an existing record) also counts as a
 * manual override, so editing an old post never clobbers its slug.
 *
 * While typing we slugify with the trailing separator preserved so the user can
 * advance past a word boundary; the trailing separator is trimmed on blur.
 */
export function SlugWidget({
  id,
  name,
  field,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
  doc,
}: WidgetProps<string, SlugField>) {
  const separator = field.separator ?? "-";
  const manual = useRef<boolean>(Boolean(value));
  const source = field.from ? doc?.[field.from] : undefined;

  useEffect(() => {
    if (manual.current || !field.from) return;
    const next = typeof source === "string" ? slugify(source, separator) : "";
    if (next !== (value ?? "")) onChange(next === "" ? undefined : next);
  }, [source]);

  return (
    <Input
      id={id}
      name={name}
      type="text"
      value={value ?? ""}
      disabled={disabled}
      spellCheck={false}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn("font-mono", invalid && "border-destructive")}
      onChange={(e) => {
        manual.current = true;
        const next = slugify(e.currentTarget.value, separator, { trim: false });
        onChange(next === "" ? undefined : next);
      }}
      onBlur={() => {
        if (value) onChange(slugify(value, separator));
        onBlur?.();
      }}
    />
  );
}
