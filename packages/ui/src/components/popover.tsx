import { Popover as BasePopover } from "@base-ui-components/react/popover";
import type * as React from "react";
import { cn } from "#lib/cn";

const Root = BasePopover.Root;
const Trigger = BasePopover.Trigger;

function Content({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof BasePopover.Popup> & {
  align?: React.ComponentProps<typeof BasePopover.Positioner>["align"];
  sideOffset?: React.ComponentProps<typeof BasePopover.Positioner>["sideOffset"];
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner align={align} sideOffset={sideOffset}>
        <BasePopover.Popup
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

export const Popover = { Root, Trigger, Content };
