import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import { XIcon } from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "#lib/cn";

// Sheet is just a Dialog positioned against an edge. Base UI doesn't ship a
// dedicated Sheet — we compose the styled wrapper here.

const Root = BaseDialog.Root;
const Trigger = BaseDialog.Trigger;
const Close = BaseDialog.Close;
const Portal = BaseDialog.Portal;

function Overlay({ className, ...props }: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/80 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition-transform ease-in-out duration-300",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full",
        bottom:
          "inset-x-0 bottom-0 border-t data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface SheetContentProps
  extends React.ComponentProps<typeof BaseDialog.Popup>,
    VariantProps<typeof sheetVariants> {}

function Content({ side = "right", className, children, ...props }: SheetContentProps) {
  return (
    <Portal>
      <Overlay />
      <BaseDialog.Popup className={cn(sheetVariants({ side }), className)} {...props}>
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

function Title({ className, ...props }: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function Description({ className, ...props }: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export const Sheet = {
  Root,
  Trigger,
  Close,
  Portal,
  Overlay,
  Content,
  Header,
  Footer,
  Title,
  Description,
};
