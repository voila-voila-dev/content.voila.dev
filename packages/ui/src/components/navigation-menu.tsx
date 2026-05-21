import { NavigationMenu as BaseNavigationMenu } from "@base-ui-components/react/navigation-menu";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "#lib/cn";

function Root({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseNavigationMenu.Root>) {
  return (
    <BaseNavigationMenu.Root
      className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
      {...props}
    >
      {children}
    </BaseNavigationMenu.Root>
  );
}

function List({ className, ...props }: React.ComponentProps<typeof BaseNavigationMenu.List>) {
  return (
    <BaseNavigationMenu.List
      className={cn("group flex flex-1 list-none items-center justify-center space-x-1", className)}
      {...props}
    />
  );
}

const Item = BaseNavigationMenu.Item;

export const navigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:bg-accent/50",
);

function Trigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseNavigationMenu.Trigger>) {
  return (
    <BaseNavigationMenu.Trigger
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      {...props}
    >
      {children}{" "}
      <CaretDownIcon
        className="relative top-px ml-1 h-3 w-3 transition duration-300 group-data-[popup-open]:rotate-180"
        aria-hidden="true"
      />
    </BaseNavigationMenu.Trigger>
  );
}

function Content({ className, ...props }: React.ComponentProps<typeof BaseNavigationMenu.Content>) {
  return (
    <BaseNavigationMenu.Content
      className={cn(
        "left-0 top-0 w-full transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:absolute md:w-auto",
        className,
      )}
      {...props}
    />
  );
}

const Link = BaseNavigationMenu.Link;

function Viewport({
  className,
  ...props
}: React.ComponentProps<typeof BaseNavigationMenu.Viewport>) {
  return (
    <BaseNavigationMenu.Portal>
      <BaseNavigationMenu.Positioner>
        <BaseNavigationMenu.Popup className="origin-top">
          <BaseNavigationMenu.Viewport
            className={cn(
              "relative mt-1.5 h-[var(--positioner-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow md:w-[var(--positioner-width)]",
              className,
            )}
            {...props}
          />
        </BaseNavigationMenu.Popup>
      </BaseNavigationMenu.Positioner>
    </BaseNavigationMenu.Portal>
  );
}

export const NavigationMenu = { Root, List, Item, Trigger, Content, Link, Viewport };
