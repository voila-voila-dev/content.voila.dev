import type * as React from "react";
import { cn } from "#lib/cn";

// Base UI uses native `<label>` paired with `Field` parts — no dedicated Label
// primitive. This is a styled wrapper around the native element.

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: consumers pair this with their own input via htmlFor or nesting
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
