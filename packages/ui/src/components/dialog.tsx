import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import type * as React from "react";
import { cn } from "#lib/cn";

const Root = BaseDialog.Root;
const Trigger = BaseDialog.Trigger;
const Portal = BaseDialog.Portal;
const Close = BaseDialog.Close;

function Overlay({ className, ...props }: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/80 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function Content({ className, children, ...props }: React.ComponentProps<typeof BaseDialog.Popup>) {
  return (
    <Portal>
      <Overlay />
      <BaseDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg transition-all duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:scale-95 sm:rounded-lg",
          className,
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </Portal>
  );
}

function Header({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
      {...props}
    />
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

function Title({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function Description({ className, ...props }: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export const Dialog = {
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
