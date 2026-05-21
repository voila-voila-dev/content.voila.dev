import { ScrollArea as BaseScrollArea } from "@base-ui-components/react/scroll-area";
import type * as React from "react";
import { cn } from "#lib/cn";

function Root({ className, children, ...props }: React.ComponentProps<typeof BaseScrollArea.Root>) {
  return (
    <BaseScrollArea.Root className={cn("relative overflow-hidden", className)} {...props}>
      <BaseScrollArea.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </BaseScrollArea.Viewport>
      <Bar />
      <BaseScrollArea.Corner />
    </BaseScrollArea.Root>
  );
}

function Bar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof BaseScrollArea.Scrollbar>) {
  return (
    <BaseScrollArea.Scrollbar
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-px",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-px",
        className,
      )}
      {...props}
    >
      <BaseScrollArea.Thumb className="relative flex-1 rounded-full bg-border" />
    </BaseScrollArea.Scrollbar>
  );
}

export const ScrollArea = { Root, Bar };
