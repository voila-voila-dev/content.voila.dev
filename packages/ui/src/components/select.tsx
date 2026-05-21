import { Select as BaseSelect } from "@base-ui-components/react/select";
import { CaretDownIcon, CaretUpIcon, CheckIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "#lib/cn";

const Root = BaseSelect.Root;
const Group = BaseSelect.Group;
const Value = BaseSelect.Value;

function Trigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon render={<CaretDownIcon className="h-4 w-4 opacity-50" />} />
    </BaseSelect.Trigger>
  );
}

function ScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.ScrollUpArrow>) {
  return (
    <BaseSelect.ScrollUpArrow
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <CaretUpIcon className="h-4 w-4" />
    </BaseSelect.ScrollUpArrow>
  );
}

function ScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.ScrollDownArrow>) {
  return (
    <BaseSelect.ScrollDownArrow
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      {...props}
    >
      <CaretDownIcon className="h-4 w-4" />
    </BaseSelect.ScrollDownArrow>
  );
}

function Content({ className, children, ...props }: React.ComponentProps<typeof BaseSelect.Popup>) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4}>
        <BaseSelect.Popup
          className={cn(
            "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        >
          <ScrollUpButton />
          {children}
          <ScrollDownButton />
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

function Label({ className, ...props }: React.ComponentProps<typeof BaseSelect.GroupLabel>) {
  return (
    <BaseSelect.GroupLabel
      className={cn("px-2 py-1.5 text-sm font-semibold", className)}
      {...props}
    />
  );
}

function Item({ className, children, ...props }: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <BaseSelect.ItemIndicator>
          <CheckIcon className="h-4 w-4" weight="bold" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

function Separator({ className, ...props }: React.ComponentProps<typeof BaseSelect.Separator>) {
  return <BaseSelect.Separator className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
}

export const Select = {
  Root,
  Group,
  Value,
  Trigger,
  ScrollUpButton,
  ScrollDownButton,
  Content,
  Label,
  Item,
  Separator,
};
