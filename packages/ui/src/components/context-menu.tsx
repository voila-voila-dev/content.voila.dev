import { ContextMenu as BaseContextMenu } from "@base-ui-components/react/context-menu";
import { Menu } from "@base-ui-components/react/menu";
import { CaretRightIcon, CheckIcon, CircleIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "#lib/cn";

// Base UI's ContextMenu re-uses Menu parts under the hood — the only special
// pieces are the right-click `Root` + `Trigger`. Everything else (Item, etc.)
// comes from `Menu`.

const Root = BaseContextMenu.Root;
const Trigger = BaseContextMenu.Trigger;
const Group = Menu.Group;
const Portal = Menu.Portal;
const Sub = Menu.SubmenuRoot;
const RadioGroup = Menu.RadioGroup;

function SubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof Menu.SubmenuTrigger> & { inset?: boolean }) {
  return (
    <Menu.SubmenuTrigger
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto h-4 w-4" />
    </Menu.SubmenuTrigger>
  );
}

function SubContent({ className, ...props }: React.ComponentProps<typeof Menu.Popup>) {
  return (
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function Content({ className, ...props }: React.ComponentProps<typeof Menu.Popup>) {
  return (
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function Item({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof Menu.Item> & { inset?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function CheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem
      checked={checked}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <Menu.CheckboxItemIndicator>
          <CheckIcon className="h-4 w-4" weight="bold" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

function RadioItem({ className, children, ...props }: React.ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <Menu.RadioItemIndicator>
          <CircleIcon className="h-2 w-2" weight="fill" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

function Label({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof Menu.GroupLabel> & { inset?: boolean }) {
  return (
    <Menu.GroupLabel
      className={cn(
        "px-2 py-1.5 text-sm font-semibold text-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function Separator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

function Shortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export const ContextMenu = {
  Root,
  Trigger,
  Group,
  Portal,
  Sub,
  RadioGroup,
  SubTrigger,
  SubContent,
  Content,
  Item,
  CheckboxItem,
  RadioItem,
  Label,
  Separator,
  Shortcut,
};
