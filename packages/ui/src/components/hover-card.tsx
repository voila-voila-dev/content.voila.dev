import { PreviewCard } from "@base-ui-components/react/preview-card";
import type * as React from "react";
import { cn } from "#lib/cn";

// Base UI calls this "PreviewCard"; shadcn uses "HoverCard". Same semantics.

const Root = PreviewCard.Root;
const Trigger = PreviewCard.Trigger;

function Content({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PreviewCard.Popup> & {
  align?: React.ComponentProps<typeof PreviewCard.Positioner>["align"];
  sideOffset?: React.ComponentProps<typeof PreviewCard.Positioner>["sideOffset"];
}) {
  return (
    <PreviewCard.Portal>
      <PreviewCard.Positioner align={align} sideOffset={sideOffset}>
        <PreviewCard.Popup
          className={cn(
            "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  );
}

export const HoverCard = { Root, Trigger, Content };
