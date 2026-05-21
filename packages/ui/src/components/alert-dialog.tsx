import { AlertDialog as BaseAlertDialog } from "@base-ui-components/react/alert-dialog";
import type * as React from "react";
import { Button, buttonVariants } from "#components/button";
import { cn } from "#lib/cn";

const Root = BaseAlertDialog.Root;
const Trigger = BaseAlertDialog.Trigger;
const Portal = BaseAlertDialog.Portal;

function Overlay({ className, ...props }: React.ComponentProps<typeof BaseAlertDialog.Backdrop>) {
  return (
    <BaseAlertDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/80 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function Content({ className, ...props }: React.ComponentProps<typeof BaseAlertDialog.Popup>) {
  return (
    <Portal>
      <Overlay />
      <BaseAlertDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95 sm:rounded-lg",
          className,
        )}
        {...props}
      />
    </Portal>
  );
}

function Header({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
  );
}

function Footer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  );
}

function Title({ className, ...props }: React.ComponentProps<typeof BaseAlertDialog.Title>) {
  return <BaseAlertDialog.Title className={cn("text-lg font-semibold", className)} {...props} />;
}

function Description({
  className,
  ...props
}: React.ComponentProps<typeof BaseAlertDialog.Description>) {
  return (
    <BaseAlertDialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function Action({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <BaseAlertDialog.Close
      render={(closeProps) => <Button {...closeProps} className={cn(className)} {...props} />}
    />
  );
}

function Cancel({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <BaseAlertDialog.Close
      render={(closeProps) => (
        <button
          {...closeProps}
          className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
          {...props}
        />
      )}
    />
  );
}

export const AlertDialog = {
  Root,
  Trigger,
  Portal,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
  Action,
  Cancel,
};
