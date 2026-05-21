import type * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "#lib/cn";

function Root({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />;
}

const Trigger = DrawerPrimitive.Trigger;
const Portal = DrawerPrimitive.Portal;
const Close = DrawerPrimitive.Close;

function Overlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      {...props}
    />
  );
}

function Content({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <Portal>
      <Overlay />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        {children}
      </DrawerPrimitive.Content>
    </Portal>
  );
}

function Header({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />;
}

function Footer({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function Title({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function Description({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export const Drawer = {
  Root,
  Trigger,
  Portal,
  Close,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
};
