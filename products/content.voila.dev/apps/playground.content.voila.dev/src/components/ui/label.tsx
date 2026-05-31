// VENDED by @voila/content-registry — you own this file.
import type { LabelHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: generic primitive — callers pass `htmlFor`.
    <label
      className={cn("text-sm font-medium leading-none text-foreground", className)}
      {...props}
    />
  );
}
