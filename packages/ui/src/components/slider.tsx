import { Slider as BaseSlider } from "@base-ui-components/react/slider";
import type * as React from "react";
import { cn } from "#lib/cn";

export function Slider({ className, ...props }: React.ComponentProps<typeof BaseSlider.Root>) {
  return (
    <BaseSlider.Root
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <BaseSlider.Control className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <BaseSlider.Track className="absolute inset-0">
          <BaseSlider.Indicator className="absolute h-full bg-primary" />
        </BaseSlider.Track>
      </BaseSlider.Control>
      <BaseSlider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </BaseSlider.Root>
  );
}
