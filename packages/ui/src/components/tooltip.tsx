import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";
import type * as React from "react";
import { cn } from "#lib/cn";

const Provider = BaseTooltip.Provider;
const Root = BaseTooltip.Root;
const Trigger = BaseTooltip.Trigger;

function Content({
  className,
  sideOffset = 4,
  side,
  align,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Popup> & {
  sideOffset?: React.ComponentProps<typeof BaseTooltip.Positioner>["sideOffset"];
  side?: React.ComponentProps<typeof BaseTooltip.Positioner>["side"];
  align?: React.ComponentProps<typeof BaseTooltip.Positioner>["align"];
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} side={side} align={align}>
        <BaseTooltip.Popup
          className={cn(
            "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-all duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

export const Tooltip = { Provider, Root, Trigger, Content };
