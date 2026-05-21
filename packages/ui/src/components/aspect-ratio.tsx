import type * as React from "react";
import { cn } from "#lib/cn";

// Base UI does not ship an AspectRatio primitive — Tailwind/native CSS handles
// it. This is a thin styled wrapper around `aspect-ratio` so callers keep the
// shadcn-shaped API.

export interface AspectRatioProps extends React.ComponentProps<"div"> {
  ratio?: number;
}

export function AspectRatio({ ratio = 1, className, style, ...props }: AspectRatioProps) {
  return (
    <div
      style={{ aspectRatio: `${ratio} / 1`, ...style }}
      className={cn("relative w-full", className)}
      {...props}
    />
  );
}
