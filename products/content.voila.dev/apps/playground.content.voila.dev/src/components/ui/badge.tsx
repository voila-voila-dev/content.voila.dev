// VENDED by @voila/content-registry — you own this file.
import type { HTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        "bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
